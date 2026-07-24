import { query } from '@/lib/db';
import type { HppMenu, HppRecipe } from './hpp';

export async function getOutletHppStats(outletId: number) {
  const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
  const venueIds = venuesRes.rows.map(r => r.venue_id);
  
  if (!venueIds.length) {
    return { totalMenus: 0, totalIngredients: 0, totalRecipes: 0, byVenue: [], marginBreakdown: [] };
  }
  
  const vList = venueIds.join(',');

  const [menus, recipes, byVenue, margin] = await Promise.all([
    query<{ cnt: number }>(`
      SELECT COUNT(DISTINCT m.id)::int AS cnt 
      FROM menus m
      JOIN recipes r ON r.menu_id = m.id
      WHERE r.venue_id IN (${vList})
        AND EXISTS (SELECT 1 FROM moka_items mi WHERE mi.outlet_id = $1 AND mi.name = m.name AND mi.is_deleted IS NOT TRUE)
    `, [outletId]),
    query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM recipes WHERE venue_id IN (${vList})`),
    query<{ venue: string; count: number }>(`
      SELECT v.id, v.name AS venue, COUNT(DISTINCT r.id)::int AS count
      FROM venues v
      JOIN recipes r ON r.venue_id = v.id
      JOIN menus m ON m.id = r.menu_id
      WHERE v.id IN (${vList})
        AND EXISTS (SELECT 1 FROM moka_items mi WHERE mi.outlet_id = $1 AND mi.name = m.name AND mi.is_deleted IS NOT TRUE)
      GROUP BY v.id, v.name ORDER BY v.id
    `, [outletId]),
    query<{ flag: string; count: number }>(`
      SELECT 
        CASE
          WHEN COALESCE(omp.sale_price, m.sale_price) > 0 THEN
            CASE
              WHEN (m.hpp / COALESCE(omp.sale_price, m.sale_price)) < 0.35 THEN 'GREEN'
              WHEN (m.hpp / COALESCE(omp.sale_price, m.sale_price)) < 0.50 THEN 'YELLOW'
              ELSE 'RED'
            END
          ELSE
            CASE
              WHEN m.hpp_ratio < 0.35 THEN 'GREEN'
              WHEN m.hpp_ratio < 0.50 THEN 'YELLOW'
              ELSE 'RED'
            END
        END AS flag,
        COUNT(DISTINCT m.id)::int AS count
      FROM menus m
      JOIN recipes r ON r.menu_id = m.id
      LEFT JOIN outlet_menu_prices omp ON omp.menu_id = m.id AND omp.outlet_id = $1
      WHERE r.venue_id IN (${vList})
        AND EXISTS (SELECT 1 FROM moka_items mi WHERE mi.outlet_id = $1 AND mi.name = m.name AND mi.is_deleted IS NOT TRUE)
      GROUP BY flag
    `, [outletId]),
  ]);

  // For ingredients, just an approximation of ingredients used in these recipes
  const ingredients = await query<{ cnt: number }>(`
    SELECT COUNT(DISTINCT ri.ingredient_id)::int AS cnt
    FROM recipe_ingredients ri
    JOIN recipes r ON r.id = ri.recipe_id
    JOIN menus m ON m.id = r.menu_id
    WHERE r.venue_id IN (${vList})
      AND EXISTS (SELECT 1 FROM moka_items mi WHERE mi.outlet_id = $1 AND mi.name = m.name AND mi.is_deleted IS NOT TRUE)
  `, [outletId]);

  return {
    totalMenus: menus.rows[0]?.cnt ?? 0,
    totalIngredients: ingredients.rows[0]?.cnt ?? 0,
    totalRecipes: recipes.rows[0]?.cnt ?? 0,
    byVenue: byVenue.rows,
    marginBreakdown: margin.rows,
  };
}

export async function getOutletHppCategories(outletId: number) {
  const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
  const venueIds = venuesRes.rows.map(r => r.venue_id);
  if (!venueIds.length) return [];
  
  const res = await query(`
    SELECT DISTINCT c.id, c.name
    FROM menu_categories c
    JOIN menus m ON m.category_id = c.id
    JOIN recipes r ON r.menu_id = m.id
    WHERE r.venue_id = ANY($1)
      AND EXISTS (SELECT 1 FROM moka_items mi WHERE mi.outlet_id = $2 AND mi.name = m.name AND mi.is_deleted IS NOT TRUE)
    ORDER BY c.name
  `, [venueIds, outletId]);
  
  return res.rows;
}

export async function getOutletHppVenues(outletId: number) {
  const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
  const venueIds = venuesRes.rows.map(r => r.venue_id);
  if (!venueIds.length) return [];

  const res = await query(`
    SELECT id, name FROM venues WHERE id = ANY($1) ORDER BY name
  `, [venueIds]);
  
  return res.rows;
}

export async function getOutletHppMenus(outletId: number, opts?: { categoryId?: number; marginFlag?: string; search?: string; limit?: number; offset?: number }) {
  const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
  const venueIds = venuesRes.rows.map(r => r.venue_id);
  if (!venueIds.length) return { data: [], total: 0 };
  
  const params: unknown[] = [outletId, venueIds]; // $1 = outletId, $2 = venueIds
  const conditions: string[] = [
    `r.venue_id = ANY($2)`,
    `EXISTS (SELECT 1 FROM moka_items mi WHERE mi.outlet_id = $1 AND mi.name = m.name AND mi.is_deleted IS NOT TRUE)`
  ];
  let idx = 3;

  if (opts?.categoryId) {
    conditions.push(`m.category_id = $${idx++}`);
    params.push(opts.categoryId);
  }
  if (opts?.marginFlag) {
    conditions.push(`
      CASE
        WHEN m.hpp_ratio < 0.35 THEN 'GREEN'
        WHEN m.hpp_ratio < 0.50 THEN 'YELLOW'
        ELSE 'RED'
      END = $${idx++}
    `);
    params.push(opts.marginFlag);
  }
  if (opts?.search) {
    conditions.push(`(m.display_name ILIKE $${idx} OR m.name ILIKE $${idx})`);
    params.push(`%${opts.search}%`);
    idx++;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const countRes = await query<{ cnt: number }>(`
    SELECT COUNT(DISTINCT m.id)::int AS cnt
    FROM menus m
    JOIN recipes r ON r.menu_id = m.id
    LEFT JOIN outlet_menu_prices omp ON omp.menu_id = m.id AND omp.outlet_id = $1
    ${where}
  `, params);

    const dataRes = await query<HppMenu & { is_overridden?: boolean }>(`
      SELECT DISTINCT ON (c.name, m.name, m.variant, m.id)
        m.id, m.category_id, c.name AS category_name, m.name, m.variant, m.display_name,
        COALESCE(omp.sale_price, m.sale_price) AS sale_price,
        m.hpp,
        CASE
          WHEN COALESCE(omp.sale_price, m.sale_price) > 0 THEN (m.hpp / COALESCE(omp.sale_price, m.sale_price))
          ELSE m.hpp_ratio
        END AS hpp_ratio,
        m.notes,
        CASE
          WHEN COALESCE(omp.sale_price, m.sale_price) > 0 THEN
            CASE
              WHEN (m.hpp / COALESCE(omp.sale_price, m.sale_price)) < 0.35 THEN 'GREEN'
              WHEN (m.hpp / COALESCE(omp.sale_price, m.sale_price)) < 0.50 THEN 'YELLOW'
              ELSE 'RED'
            END
          ELSE
            CASE
              WHEN m.hpp_ratio IS NULL THEN NULL
              WHEN m.hpp_ratio < 0.35 THEN 'GREEN'
              WHEN m.hpp_ratio < 0.50 THEN 'YELLOW'
              ELSE 'RED'
            END
        END AS margin_flag,
        (omp.sale_price IS NOT NULL) AS is_overridden
      FROM menus m
      JOIN recipes r ON r.menu_id = m.id
      LEFT JOIN menu_categories c ON c.id = m.category_id
      LEFT JOIN outlet_menu_prices omp ON omp.menu_id = m.id AND omp.outlet_id = $1
      ${where}
      ORDER BY c.name, m.name, m.variant, m.id
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

  return { data: dataRes.rows, total: countRes.rows[0]?.cnt ?? 0 };
}

export async function getOutletHppRecipes(outletId: number, opts?: { search?: string; venueId?: number; sourceSheet?: string; limit?: number; offset?: number }) {
  const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
  let venueIds = venuesRes.rows.map(r => r.venue_id);
  if (!venueIds.length) return { data: [], total: 0 };
  
  // If venueId is provided, filter it further to ensure it belongs to the outlet
  if (opts?.venueId) {
    if (venueIds.includes(opts.venueId)) {
      venueIds = [opts.venueId];
    } else {
      return { data: [], total: 0 }; // Not allowed
    }
  }

  const params: unknown[] = [venueIds, outletId];
  const conditions: string[] = [
    `r.venue_id = ANY($1)`,
    `EXISTS (
      SELECT 1 FROM menus m
      JOIN moka_items mi ON mi.name = m.name
      WHERE m.id = r.menu_id 
        AND mi.outlet_id = $2 
        AND mi.is_deleted IS NOT TRUE
    )`
  ];
  let idx = 3;

  if (opts?.search) {
    conditions.push(`r.name ILIKE $${idx++}`);
    params.push(`%${opts.search}%`);
  }
  if (opts?.sourceSheet) {
    conditions.push(`r.source_sheet = $${idx++}`);
    params.push(opts.sourceSheet);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const countRes = await query<{ cnt: number }>(`
    SELECT COUNT(*)::int AS cnt FROM recipes r ${where}
  `, params);

  const dataRes = await query<HppRecipe>(`
    SELECT 
      r.id, r.venue_id, v.name AS venue_name,
      r.menu_id, r.name, r.source_sheet, r.source_name,
      r.yield, r.yield_unit, r.subtotal, r.x_factor_pct,
      r.total_cost, r.sale_price
    FROM recipes r
    JOIN venues v ON v.id = r.venue_id
    ${where}
    ORDER BY r.source_sheet, r.name
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  return { data: dataRes.rows, total: countRes.rows[0]?.cnt ?? 0 };
}

export async function getOutletHppKitchenSummary(outletId: number) {
  const venuesRes = await query(`SELECT venue_id FROM outlet_venues WHERE outlet_id = $1`, [outletId]);
  const venueIds = venuesRes.rows.map(r => r.venue_id);
  if (!venueIds.length) return [];
  
  const res = await query(`
    SELECT DISTINCT
      k.recipe_name, k.source_sheet, k.yield_amount, k.yield_unit,
      k.sale_price, k.raw_cost, k.total_cost_with_xfactor,
      k.cost_per_unit_yield, k.hpp_ratio_pct
    FROM v_kitchen_hpp_summary k
    JOIN recipes r ON r.name = k.recipe_name
    WHERE r.venue_id = ANY($1)
      AND EXISTS (
        SELECT 1 FROM menus m
        JOIN moka_items mi ON mi.name = m.name
        WHERE m.id = r.menu_id 
          AND mi.outlet_id = $2 
          AND mi.is_deleted IS NOT TRUE
      )
    ORDER BY k.source_sheet, k.hpp_ratio_pct DESC NULLS LAST
  `, [venueIds, outletId]);
  
  return res.rows;
}

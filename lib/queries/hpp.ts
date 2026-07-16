/**
 * lib/queries/hpp.ts
 * Query functions untuk data HPP ER Coffeelab
 * Semua raw SQL harus di sini — TIDAK boleh di route.ts atau component
 */
import { query, withTransaction } from '@/lib/db';
import type { PoolClient } from 'pg';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type HppVenue = {
  id: bigint;
  name: string;
};

export type HppCategory = {
  id: bigint;
  name: string;
};

export type HppMenu = {
  id: bigint;
  category_id: bigint;
  category_name: string;
  name: string;
  variant: string | null;
  display_name: string | null;
  sale_price: number;
  hpp: number | null;
  hpp_ratio: number | null;
  notes: string | null;
  margin_flag: 'GREEN' | 'YELLOW' | 'RED' | null;
};

export type HppRecipe = {
  id: bigint;
  venue_id: bigint;
  venue_name: string;
  menu_id: bigint | null;
  name: string;
  source_sheet: string;
  source_name: string | null;
  yield: number;
  yield_unit: string | null;
  subtotal: number | null;
  x_factor_pct: number;
  total_cost: number | null;
  sale_price: number | null;
};

export type HppRecipeIngredient = {
  id: bigint;
  recipe_id: bigint;
  recipe_name: string;
  source_sheet: string;
  ingredient_id: bigint;
  ingredient_name: string;
  default_unit: string | null;
  standard_cost_per_unit: number | null;
  quantity: number;
  unit: string | null;
  cost_per_unit: number | null;
  extension: number | null;
  sort_order: number;
};

export type HppIngredient = {
  id: bigint;
  item_id: bigint | null;
  name: string;
  default_unit: string | null;
  standard_cost_per_unit: number | null;
  description: string | null;
  used_in_recipes: number;
  is_linked?: boolean;
};

export type HppVsSale = {
  category: string;
  menu_name: string;
  variant: string | null;
  sale_price: number;
  hpp: number | null;
  hpp_pct: number | null;
  margin_flag: string;
};

export type HppKitchenSummary = {
  recipe_name: string;
  source_sheet: string;
  yield_amount: number;
  yield_unit: string | null;
  sale_price: number;
  raw_cost: number | null;
  total_cost_with_xfactor: number | null;
  cost_per_unit_yield: number | null;
  hpp_ratio_pct: number | null;
};

// ─────────────────────────────────────────────
// VENUES
// ─────────────────────────────────────────────

export async function getHppVenues(): Promise<HppVenue[]> {
  const res = await query<HppVenue>(`
    SELECT id, name FROM venues ORDER BY id
  `);
  return res.rows;
}

// ─────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────

export async function getHppCategories(): Promise<HppCategory[]> {
  const res = await query<HppCategory>(`
    SELECT id, name FROM menu_categories ORDER BY name
  `);
  return res.rows;
}

// ─────────────────────────────────────────────
// MENUS — dengan filter opsional
// ─────────────────────────────────────────────

export async function getHppMenus(opts?: {
  categoryId?: number;
  marginFlag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: HppMenu[]; total: number }> {
  const params: unknown[] = [];
  const conditions: string[] = [];
  let idx = 1;

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
    idx++;
    params.push(`%${opts.search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const countRes = await query<{ cnt: number }>(`
    SELECT COUNT(*)::int AS cnt
    FROM menus m
    JOIN menu_categories c ON c.id = m.category_id
    ${where}
  `, params);

  const dataRes = await query<HppMenu>(`
    SELECT 
      m.id, m.category_id, c.name AS category_name,
      m.name, m.variant, m.display_name,
      m.sale_price, m.hpp, m.hpp_ratio, m.notes,
      CASE
        WHEN m.hpp_ratio IS NULL THEN NULL
        WHEN m.hpp_ratio < 0.35 THEN 'GREEN'
        WHEN m.hpp_ratio < 0.50 THEN 'YELLOW'
        ELSE 'RED'
      END AS margin_flag
    FROM menus m
    JOIN menu_categories c ON c.id = m.category_id
    ${where}
    ORDER BY c.name, m.name, m.variant
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  return { data: dataRes.rows, total: countRes.rows[0]?.cnt ?? 0 };
}

// ─────────────────────────────────────────────
// RECIPES — dengan filter venue & source_sheet
// ─────────────────────────────────────────────

export async function getHppRecipes(opts?: {
  venueId?: number;
  sourceSheet?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: HppRecipe[]; total: number }> {
  const params: unknown[] = [];
  const conditions: string[] = [];
  let idx = 1;

  if (opts?.venueId) {
    conditions.push(`r.venue_id = $${idx++}`);
    params.push(opts.venueId);
  }
  if (opts?.sourceSheet) {
    conditions.push(`r.source_sheet = $${idx++}`);
    params.push(opts.sourceSheet);
  }
  if (opts?.search) {
    conditions.push(`r.name ILIKE $${idx++}`);
    params.push(`%${opts.search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
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

// ─────────────────────────────────────────────
// RECIPE DETAIL (ingredients list)
// ─────────────────────────────────────────────

export async function getHppRecipeDetail(recipeId: number): Promise<{
  recipe: HppRecipe | null;
  ingredients: HppRecipeIngredient[];
}> {
  const recipeRes = await query<HppRecipe>(`
    SELECT 
      r.id, r.venue_id, v.name AS venue_name,
      r.menu_id, r.name, r.source_sheet, r.source_name,
      r.yield, r.yield_unit, r.subtotal, r.x_factor_pct,
      r.total_cost, r.sale_price
    FROM recipes r
    JOIN venues v ON v.id = r.venue_id
    WHERE r.id = $1
  `, [recipeId]);

  const ingRes = await query<HppRecipeIngredient>(`
    SELECT 
      ri.id, ri.recipe_id,
      r.name AS recipe_name, r.source_sheet,
      ri.ingredient_id, 
      COALESCE(it.name, i.name) AS ingredient_name,
      COALESCE(it.smallest_unit, i.default_unit) AS default_unit,
      COALESCE((it.current_average_price / NULLIF(it.conversion_ratio, 0)), i.standard_cost_per_unit) AS standard_cost_per_unit,
      ri.quantity, ri.unit, ri.cost_per_unit, ri.extension, ri.sort_order
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    LEFT JOIN items it ON it.id = i.item_id
    JOIN recipes r ON r.id = ri.recipe_id
    WHERE ri.recipe_id = $1
    ORDER BY ri.sort_order
  `, [recipeId]);

  return {
    recipe: recipeRes.rows[0] ?? null,
    ingredients: ingRes.rows,
  };
}

// ─────────────────────────────────────────────
// INGREDIENTS MASTER
// ─────────────────────────────────────────────

export async function getHppIngredients(opts?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: HppIngredient[]; total: number }> {
  const params: unknown[] = [];
  const conditions: string[] = [];
  let idx = 1;

  if (opts?.search) {
    conditions.push(`i.name ILIKE $${idx++}`);
    params.push(`%${opts.search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const countRes = await query<{ cnt: number }>(`
    SELECT COUNT(*)::int AS cnt FROM ingredients i ${where}
  `, params);

  const dataRes = await query<HppIngredient>(`
    SELECT 
      i.id, i.item_id, 
      COALESCE(it.name, i.name) AS name,
      COALESCE(it.smallest_unit, i.default_unit) AS default_unit,
      COALESCE((it.current_average_price / NULLIF(it.conversion_ratio, 0)), i.standard_cost_per_unit) AS standard_cost_per_unit,
      i.description,
      COALESCE(COUNT(ri.id)::int, 0) AS used_in_recipes,
      (it.id IS NOT NULL) AS is_linked
    FROM ingredients i
    LEFT JOIN items it ON it.id = i.item_id
    LEFT JOIN recipe_ingredients ri ON ri.ingredient_id = i.id
    ${where}
    GROUP BY i.id, it.id, i.name, it.name, it.smallest_unit, i.default_unit, it.current_average_price, it.conversion_ratio, i.standard_cost_per_unit, i.description
    ORDER BY used_in_recipes DESC, COALESCE(it.name, i.name)
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  return { data: dataRes.rows, total: countRes.rows[0]?.cnt ?? 0 };
}

// ─────────────────────────────────────────────
// ANALYTICS VIEWS
// ─────────────────────────────────────────────

type HppVsaleRow = {
  category: string;
  menu_name: string;
  variant: string | null;
  sale_price: number;
  hpp: number | null;
  hpp_pct: number | null;
  margin_flag: string;
};

export async function getHppVsSale(opts?: {
  marginFlag?: string;
  category?: string;
}): Promise<HppVsaleRow[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];
  let idx = 1;

  if (opts?.marginFlag && opts.marginFlag !== 'ALL') {
    conditions.push(`margin_flag = $${idx++}`);
    params.push(opts.marginFlag);
  }
  if (opts?.category) {
    conditions.push(`category = $${idx++}`);
    params.push(opts.category);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await query<HppVsaleRow>(`
    SELECT category, menu_name, variant, sale_price, hpp, hpp_pct, margin_flag
    FROM v_hpp_vs_sale
    ${where}
    ORDER BY margin_flag DESC, hpp_pct DESC NULLS LAST
  `, params);

  return res.rows;
}

export async function getHppKitchenSummary(): Promise<HppKitchenSummary[]> {
  const res = await query<HppKitchenSummary>(`
    SELECT 
      recipe_name, source_sheet, yield_amount, yield_unit,
      sale_price, raw_cost, total_cost_with_xfactor,
      cost_per_unit_yield, hpp_ratio_pct
    FROM v_kitchen_hpp_summary
    ORDER BY source_sheet, hpp_ratio_pct DESC NULLS LAST
  `);
  return res.rows;
}

// ─────────────────────────────────────────────
// STATS SUMMARY
// ─────────────────────────────────────────────

export async function getHppStats(): Promise<{
  totalMenus: number;
  totalIngredients: number;
  totalRecipes: number;
  byVenue: { venue: string; count: number }[];
  marginBreakdown: { flag: string; count: number }[];
}> {
  const [menus, ingredients, recipes, byVenue, margin] = await Promise.all([
    query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM menus`),
    query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM ingredients`),
    query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM recipes`),
    query<{ venue: string; count: number }>(`
      SELECT v.id, v.name AS venue, COUNT(r.id)::int AS count
      FROM venues v
      LEFT JOIN recipes r ON r.venue_id = v.id
      GROUP BY v.id, v.name ORDER BY v.id
    `),
    query<{ flag: string; count: number }>(`
      SELECT margin_flag AS flag, COUNT(*)::int AS count
      FROM v_hpp_vs_sale
      WHERE hpp IS NOT NULL
      GROUP BY margin_flag
      ORDER BY margin_flag
    `),
  ]);

  return {
    totalMenus: menus.rows[0]?.cnt ?? 0,
    totalIngredients: ingredients.rows[0]?.cnt ?? 0,
    totalRecipes: recipes.rows[0]?.cnt ?? 0,
    byVenue: byVenue.rows,
    marginBreakdown: margin.rows,
  };
}

// ─────────────────────────────────────────────
// MUTATIONS (CRUD RECIPES)
// ─────────────────────────────────────────────

export async function createRecipe(data: {
  name: string;
  venue_id: number;
  source_sheet: string;
  yield_amount: number;
  yield_unit?: string;
  x_factor_pct: number;
  ingredients: { ingredient_id: number; quantity: number; unit?: string; cost_per_unit: number }[];
}) {
  return await withTransaction(async (client) => {
    // 1. Calculate subtotal
    const subtotal = data.ingredients.reduce((sum, ing) => sum + (ing.quantity * ing.cost_per_unit), 0);
    const total_cost = subtotal + (subtotal * data.x_factor_pct);

    // 2. Insert recipe
    const recRes = await client.query(`
      INSERT INTO recipes (name, venue_id, source_sheet, yield, yield_unit, subtotal, x_factor_pct, total_cost)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [data.name, data.venue_id, data.source_sheet, data.yield_amount, data.yield_unit || null, subtotal, data.x_factor_pct, total_cost]);
    
    const recipeId = recRes.rows[0].id;

    // 3. Insert ingredients
    for (let i = 0; i < data.ingredients.length; i++) {
      const ing = data.ingredients[i];
      const extension = ing.quantity * ing.cost_per_unit;
      await client.query(`
        INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, cost_per_unit, extension, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [recipeId, ing.ingredient_id, ing.quantity, ing.unit || null, ing.cost_per_unit, extension, i + 1]);
    }

    // 4. Update menus HPP and link menu_id automatically by name matching
    await client.query(`
      UPDATE recipes 
      SET menu_id = (SELECT id FROM menus WHERE display_name ILIKE $2 LIMIT 1)
      WHERE id = $1
    `, [recipeId, data.name]);

    await client.query(`
      UPDATE menus
      SET 
        hpp = r.total_cost / NULLIF(r.yield, 0),
        hpp_ratio = (r.total_cost / NULLIF(r.yield, 0)) / NULLIF(menus.sale_price, 0)
      FROM recipes r
      WHERE r.id = $1 AND menus.id = r.menu_id
    `, [recipeId]);

    return recipeId;
  });
}

export async function updateRecipe(id: number, data: {
  name: string;
  venue_id: number;
  source_sheet: string;
  yield_amount: number;
  yield_unit?: string;
  x_factor_pct: number;
  ingredients: { ingredient_id: number; quantity: number; unit?: string; cost_per_unit: number }[];
}) {
  return await withTransaction(async (client) => {
    // 1. Calculate subtotal
    const subtotal = data.ingredients.reduce((sum, ing) => sum + (ing.quantity * ing.cost_per_unit), 0);
    const total_cost = subtotal + (subtotal * data.x_factor_pct);

    // 2. Update recipe
    await client.query(`
      UPDATE recipes 
      SET name = $1, venue_id = $2, source_sheet = $3, yield = $4, yield_unit = $5, 
          subtotal = $6, x_factor_pct = $7, total_cost = $8, revision_date = CURRENT_DATE
      WHERE id = $9
    `, [data.name, data.venue_id, data.source_sheet, data.yield_amount, data.yield_unit || null, subtotal, data.x_factor_pct, total_cost, id]);

    // 3. Delete old ingredients
    await client.query(`DELETE FROM recipe_ingredients WHERE recipe_id = $1`, [id]);

    // 4. Insert new ingredients
    for (let i = 0; i < data.ingredients.length; i++) {
      const ing = data.ingredients[i];
      const extension = ing.quantity * ing.cost_per_unit;
      await client.query(`
        INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, cost_per_unit, extension, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [id, ing.ingredient_id, ing.quantity, ing.unit || null, ing.cost_per_unit, extension, i + 1]);
    }

    // 5. Update menus HPP and link menu_id automatically by name matching
    await client.query(`
      UPDATE recipes 
      SET menu_id = (SELECT id FROM menus WHERE display_name ILIKE $2 LIMIT 1)
      WHERE id = $1
    `, [id, data.name]);

    await client.query(`
      UPDATE menus
      SET 
        hpp = r.total_cost / NULLIF(r.yield, 0),
        hpp_ratio = (r.total_cost / NULLIF(r.yield, 0)) / NULLIF(menus.sale_price, 0)
      FROM recipes r
      WHERE r.id = $1 AND menus.id = r.menu_id
    `, [id]);

    return id;
  });
}

export async function deleteRecipe(id: number) {
  // Cascades automatically to recipe_ingredients due to ON DELETE CASCADE
  const res = await query(`DELETE FROM recipes WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

// ─────────────────────────────────────────────
// MUTATIONS (CRUD INGREDIENTS)
// ─────────────────────────────────────────────

export async function createIngredient(data: {
  item_id?: number | null;
  name: string;
  default_unit: string;
  standard_cost_per_unit: number;
  description?: string;
}) {
  const res = await query(`
    INSERT INTO ingredients (item_id, name, default_unit, standard_cost_per_unit, description)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [data.item_id || null, data.name, data.default_unit, data.standard_cost_per_unit, data.description || null]);
  return res.rows[0].id;
}

export async function updateIngredient(id: number, data: {
  item_id?: number | null;
  name: string;
  default_unit: string;
  standard_cost_per_unit: number;
  description?: string;
}) {
  const res = await query(`
    UPDATE ingredients 
    SET item_id = $1, name = $2, default_unit = $3, standard_cost_per_unit = $4, description = $5
    WHERE id = $6
  `, [data.item_id || null, data.name, data.default_unit, data.standard_cost_per_unit, data.description || null, id]);
  return (res.rowCount ?? 0) > 0;
}

export async function deleteIngredient(id: number) {
  const res = await query(`DELETE FROM ingredients WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

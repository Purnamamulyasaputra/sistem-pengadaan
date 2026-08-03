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
  yield: number;
  yield_unit: string | null;
  subtotal: number | null;
  x_factor_pct: number;
  total_cost: number | null;
  sale_price: number | null;
  category_id?: bigint | null;
};

export type HppRecipeIngredient = {
  id: bigint;
  recipe_id: bigint;
  recipe_name: string;
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

export async function createHppCategory(name: string): Promise<HppCategory> {
  const res = await query<HppCategory>(
    `INSERT INTO menu_categories (name) VALUES ($1) RETURNING id, name`,
    [name]
  );
  return res.rows[0];
}

export async function updateHppCategory(id: number, name: string): Promise<HppCategory> {
  const res = await query<HppCategory>(
    `UPDATE menu_categories SET name = $1 WHERE id = $2 RETURNING id, name`,
    [name, id]
  );
  return res.rows[0];
}

export async function deleteHppCategory(id: number): Promise<void> {
  await query(`DELETE FROM menu_categories WHERE id = $1`, [id]);
}


// ─────────────────────────────────────────────
// MENUS — dengan filter opsional
// ─────────────────────────────────────────────

export async function getHppMenus(opts?: {
  categoryId?: number;
  categoryName?: string;
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
  } else if (opts?.categoryName) {
    conditions.push(`c.name = $${idx++}`);
    params.push(opts.categoryName);
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
    LEFT JOIN menu_categories c ON c.id = m.category_id
    ${where}
  `, params);

  const dataRes = await query<HppMenu>(`
    SELECT 
      m.id, m.category_id, COALESCE(c.name, '—') AS category_name,
      m.name, m.variant, m.display_name,
      m.sale_price, m.hpp, m.hpp_ratio, m.notes,
      CASE
        WHEN m.hpp_ratio IS NULL THEN NULL
        WHEN m.hpp_ratio < 0.35 THEN 'GREEN'
        WHEN m.hpp_ratio < 0.50 THEN 'YELLOW'
        ELSE 'RED'
      END AS margin_flag
    FROM menus m
    LEFT JOIN menu_categories c ON c.id = m.category_id
    ${where}
    ORDER BY c.name NULLS LAST, m.name, m.variant
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  return { data: dataRes.rows, total: countRes.rows[0]?.cnt ?? 0 };
}

// ─────────────────────────────────────────────
// RECIPES — dengan filter venue
// ─────────────────────────────────────────────

export async function getHppRecipes(opts?: {
  venueId?: number;
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
      r.menu_id, r.name,
      r.yield, r.yield_unit, r.subtotal, r.x_factor_pct,
      r.total_cost, r.sale_price
    FROM recipes r
    JOIN venues v ON v.id = r.venue_id
    ${where}
    ORDER BY r.name
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
      r.menu_id, r.name,
      r.yield, r.yield_unit, r.subtotal, r.x_factor_pct,
      r.total_cost, r.sale_price,
      m.category_id
    FROM recipes r
    JOIN venues v ON v.id = r.venue_id
    LEFT JOIN menus m ON m.id = r.menu_id
    WHERE r.id = $1
  `, [recipeId]);

  const ingRes = await query<HppRecipeIngredient>(`
    SELECT 
      ri.id, ri.recipe_id,
      r.name AS recipe_name,
      ri.ingredient_id, 
      COALESCE(it.name, i.name) AS ingredient_name,
      COALESCE(it.smallest_unit, i.default_unit) AS default_unit,
      COALESCE(it.current_average_price, i.standard_cost_per_unit) AS standard_cost_per_unit,
      ri.quantity, ri.unit, ri.cost_per_unit, ri.extension, ri.sort_order
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    LEFT JOIN items it ON (it.id = i.item_id OR it.ingredient_id = i.id)
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
      COALESCE(it.current_average_price, i.standard_cost_per_unit) AS standard_cost_per_unit,
      i.description,
      COALESCE(COUNT(ri.id)::int, 0) AS used_in_recipes,
      (it.id IS NOT NULL) AS is_linked
    FROM ingredients i
    LEFT JOIN items it ON (it.id = i.item_id OR it.ingredient_id = i.id)
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
      recipe_name, yield_amount, yield_unit,
      sale_price, raw_cost, total_cost_with_xfactor,
      cost_per_unit_yield, hpp_ratio_pct
    FROM v_kitchen_hpp_summary
    ORDER BY recipe_name ASC
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
  yield_amount: number;
  yield_unit?: string;
  x_factor_pct: number;
  sale_price?: number;
  category_id?: number;
  ingredients: { ingredient_id: number; quantity: number; unit?: string; cost_per_unit: number }[];
}) {
  return await withTransaction(async (client) => {
    // 1. Calculate subtotal
    const subtotal = data.ingredients.reduce((sum, ing) => sum + (ing.quantity * ing.cost_per_unit), 0);
    const total_cost = subtotal + (subtotal * data.x_factor_pct);

    // 2. Insert recipe
    const recRes = await client.query(`
      INSERT INTO recipes (name, venue_id, yield, yield_unit, subtotal, x_factor_pct, total_cost, sale_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [data.name, data.venue_id, data.yield_amount, data.yield_unit || null, subtotal, data.x_factor_pct, total_cost, data.sale_price ?? null]);
    
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

    // 4. Update menus HPP and link menu_id automatically
    let menuRes = await client.query(`SELECT id FROM menus WHERE display_name ILIKE $1 OR name ILIKE $1 LIMIT 1`, [data.name]);
    let menuId = menuRes.rows[0]?.id;

    if (!menuId) {
      // Always create a menu entry even if category_id is not provided
      const newMenu = await client.query(`
        INSERT INTO menus (name, display_name, category_id, sale_price) 
        VALUES ($1, $2, $3, $4) 
        RETURNING id
      `, [data.name, data.name, data.category_id || null, data.sale_price || 0]);
      menuId = newMenu.rows[0].id;
    }

    if (menuId) {
      await client.query(`UPDATE recipes SET menu_id = $1 WHERE id = $2`, [menuId, recipeId]);
      await client.query(`
        UPDATE menus
        SET 
          hpp = r.total_cost / NULLIF(r.yield, 0),
          hpp_ratio = (r.total_cost / NULLIF(r.yield, 0)) / NULLIF(menus.sale_price, 0)
        FROM recipes r
        WHERE r.id = $1 AND menus.id = $2
      `, [recipeId, menuId]);
    }

    return recipeId;
  });
}

export async function updateRecipe(id: number, data: {
  name: string;
  venue_id: number;
  yield_amount: number;
  yield_unit?: string;
  x_factor_pct: number;
  sale_price?: number;
  category_id?: number;
  ingredients: { ingredient_id: number; quantity: number; unit?: string; cost_per_unit: number }[];
}) {
  return await withTransaction(async (client) => {
    // 1. Calculate subtotal
    const subtotal = data.ingredients.reduce((sum, ing) => sum + (ing.quantity * ing.cost_per_unit), 0);
    const total_cost = subtotal + (subtotal * data.x_factor_pct);

    // 2. Update recipe
    await client.query(`
      UPDATE recipes 
      SET name = $1, venue_id = $2, yield = $3, yield_unit = $4, 
          subtotal = $5, x_factor_pct = $6, total_cost = $7, sale_price = COALESCE($8, sale_price), revision_date = CURRENT_DATE
      WHERE id = $9
    `, [data.name, data.venue_id, data.yield_amount, data.yield_unit || null, subtotal, data.x_factor_pct, total_cost, data.sale_price ?? null, id]);

    if (data.category_id) {
      await client.query(`
        UPDATE menus 
        SET category_id = $1 
        WHERE id = (SELECT menu_id FROM recipes WHERE id = $2)
      `, [data.category_id, id]);
    }

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

    if (data.sale_price) {
      await client.query(`
        UPDATE menus 
        SET sale_price = $1,
            hpp_ratio = hpp / NULLIF($1, 0)
        WHERE id = (SELECT menu_id FROM recipes WHERE id = $2)
      `, [data.sale_price, id]);
    }

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

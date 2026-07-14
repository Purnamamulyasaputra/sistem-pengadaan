import { query, withTransaction } from '@/lib/db';

export type SalesSummaryRow = {
  menu_id: bigint;
  display_name: string;
  category_name: string;
  sale_price: number;
  total_qty: number;
  total_revenue: number;
};

export type IngredientRequirementRow = {
  ingredient_id: bigint;
  ingredient_name: string;
  item_id: bigint | null;
  item_name: string | null;
  category_name: string | null;
  total_raw_qty: number;
  default_unit: string | null;
};

/**
 * Mendapatkan ringkasan penjualan (Summary) per menu dalam rentang tanggal tertentu
 * Hanya menampilkan menu yang terjual di rentang tersebut.
 */
export async function getSalesSummary(outletId: number, dateFrom: string, dateTo: string): Promise<SalesSummaryRow[]> {
  const res = await query<SalesSummaryRow>(`
    SELECT 
      m.id AS menu_id,
      COALESCE(m.display_name, m.name) AS display_name,
      c.name AS category_name,
      m.sale_price,
      SUM(sti.qty)::numeric AS total_qty,
      SUM(sti.subtotal)::numeric AS total_revenue
    FROM sales_transaction_items sti
    JOIN sales_transactions st ON st.id = sti.sales_transaction_id
    JOIN menus m ON m.id = sti.menu_id
    JOIN menu_categories c ON c.id = m.category_id
    WHERE st.outlet_id = $1
      AND st.transaction_date >= $2 
      AND st.transaction_date <= $3
    GROUP BY m.id, m.display_name, m.name, c.name, m.sale_price
    ORDER BY total_qty DESC
  `, [outletId, dateFrom, dateTo]);
  
  return res.rows;
}

/**
 * Menghitung kebutuhan bahan baku berdasarkan sales.
 * Alur: Sales Menu -> Recipe -> Recipe Ingredients -> Ingredients -> Items
 */
export async function getSalesIngredientRequirements(outletId: number, dateFrom: string, dateTo: string): Promise<IngredientRequirementRow[]> {
  // 1. Ambil summary menu terjual
  const sales = await getSalesSummary(outletId, dateFrom, dateTo);
  if (sales.length === 0) return [];
  
  const menuIds = sales.map(s => Number(s.menu_id));
  
  // 2. Ambil komposisi resep untuk semua menu yang terjual
  const res = await query(`
    SELECT 
      r.menu_id,
      ri.ingredient_id,
      i.name AS ingredient_name,
      i.default_unit,
      ri.quantity AS qty_per_recipe,
      r.yield AS recipe_yield,
      it.id AS item_id,
      it.name AS item_name,
      cat.name AS category_name
    FROM recipes r
    JOIN recipe_ingredients ri ON ri.recipe_id = r.id
    JOIN ingredients i ON i.id = ri.ingredient_id
    LEFT JOIN items it ON it.ingredient_id = i.id
    LEFT JOIN categories cat ON cat.id = it.category_id
    WHERE r.menu_id = ANY($1::bigint[])
  `, [menuIds]);
  
  const recipeData = res.rows;
  
  // 3. Kalkulasi: (Qty Menu Terjual / Recipe Yield) * Qty Ingredient
  const reqMap = new Map<number, IngredientRequirementRow>();
  
  for (const s of sales) {
    const menuId = Number(s.menu_id);
    const qtySold = Number(s.total_qty);
    
    // Cari bahan baku untuk menu ini
    const ingredientsForMenu = recipeData.filter(r => Number(r.menu_id) === menuId);
    
    for (const ing of ingredientsForMenu) {
      const ingId = Number(ing.ingredient_id);
      const yieldFactor = Number(ing.recipe_yield) || 1;
      const rawQtyNeeded = (qtySold / yieldFactor) * Number(ing.qty_per_recipe);
      
      if (!reqMap.has(ingId)) {
        reqMap.set(ingId, {
          ingredient_id: BigInt(ingId),
          ingredient_name: ing.ingredient_name,
          item_id: ing.item_id ? BigInt(ing.item_id) : null,
          item_name: ing.item_name,
          category_name: ing.category_name,
          total_raw_qty: 0,
          default_unit: ing.default_unit
        });
      }
      
      reqMap.get(ingId)!.total_raw_qty += rawQtyNeeded;
    }
  }
  
  // Convert map ke array dan filter yang tidak punya item (karena request ke Gudang butuh Item ID)
  return Array.from(reqMap.values()).sort((a, b) => b.total_raw_qty - a.total_raw_qty);
}

import { query } from '../db';

export type OutletStockRow = {
  item_id: number;
  item_name: string;
  category_name: string;
  current_balance: number;
  purchase_unit: string;
  smallest_unit: string;
  minimum_threshold: number | null;
  barcode: string | null;
  incoming_balance?: number;
  conversion_ratio?: number;
};

export async function getOutletStocks(outletId: number): Promise<OutletStockRow[]> {
  const result = await query<OutletStockRow>(`
    SELECT DISTINCT
      i.id AS item_id,
      i.name AS item_name,
      c.name AS category_name,
      i.purchase_unit,
      i.smallest_unit,
      i.conversion_ratio,
      i.barcode,
      COALESCE(os.current_balance, 0)::numeric AS current_balance,
      ois.minimum_threshold,
      (
        SELECT COALESCE(SUM(oi.smallest_unit_qty), 0)
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.outlet_id = $1 AND oi.item_id = i.id 
          AND oi.item_status IN ('DITERIMA_DARI_OUTLET', 'PROSES_BELANJA', 'READY_DI_GUDANG', 'DIKIRIM')
      )::numeric AS incoming_balance
    FROM items i
    LEFT JOIN menu_categories c ON c.id = i.category_id
    LEFT JOIN outlet_stocks os ON os.item_id = i.id AND os.outlet_id = $1
    LEFT JOIN outlet_item_settings ois ON ois.item_id = i.id AND ois.outlet_id = $1
    LEFT JOIN recipe_ingredients ri ON ri.ingredient_id = i.id
    LEFT JOIN recipes r ON r.id = ri.recipe_id
    LEFT JOIN outlet_venues ov ON ov.venue_id = r.venue_id AND ov.outlet_id = $1
    WHERE i.is_active = true
      AND (
        os.outlet_id IS NOT NULL OR 
        ois.outlet_id IS NOT NULL OR 
        ov.outlet_id IS NOT NULL
      )
    ORDER BY c.name, i.name
  `, [outletId]);
  return result.rows;
}

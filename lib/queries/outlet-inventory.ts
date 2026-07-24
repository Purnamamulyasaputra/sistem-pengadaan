import { query, withTransaction } from '../db';

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
        os.outlet_id IS NOT NULL 
        OR ois.outlet_id IS NOT NULL 
        OR ov.outlet_id IS NOT NULL
      )
    ORDER BY c.name, i.name
  `, [outletId]);
  return result.rows;
}

export async function deductOutletStockFromSales(outletId: number, dateStr: string) {
  // dateStr format: YYYY-MM-DD
  return withTransaction(async (client) => {
    // Find all transactions for this outlet on this date that haven't been deducted
    const trxRes = await client.query(`
      SELECT id 
      FROM moka_transactions
      WHERE outlet_id = $1 
        AND created_at AT TIME ZONE 'Asia/Jakarta' >= $2::DATE 
        AND created_at AT TIME ZONE 'Asia/Jakarta' < ($2::DATE + INTERVAL '1 day')
        AND is_stock_deducted = false
    `, [outletId, dateStr]);

    if (trxRes.rows.length === 0) return { count: 0, itemsDeducted: 0, ingredientsDeducted: 0 };
    
    const trxIds = trxRes.rows.map(r => r.id);

    // Get aggregated sold items
    const itemsRes = await client.query(`
      SELECT item_name, SUM(quantity) as total_qty
      FROM moka_transaction_items
      WHERE transaction_id = ANY($1)
      GROUP BY item_name
    `, [trxIds]);

    let totalIngredientsDeducted = 0;

    for (const item of itemsRes.rows) {
      const qtySold = Number(item.total_qty);
      if (qtySold <= 0) continue;

      // Find recipe ingredients matching menu name or display name or prefix
      const ingRes = await client.query(`
        SELECT ing.item_id as ingredient_id, ri.quantity
        FROM menus m
        JOIN recipes r ON r.menu_id = m.id
        JOIN recipe_ingredients ri ON ri.recipe_id = r.id
        JOIN ingredients ing ON ing.id = ri.ingredient_id
        JOIN items i ON i.id = ing.item_id
        WHERE m.name = $1 OR m.display_name = $1 OR $1 ILIKE m.name || '%'
      `, [item.item_name]);

      for (const ing of ingRes.rows) {
        const qtyToDeduct = Number(ing.quantity) * qtySold;
        
        // Ensure record in outlet_stocks exists
        await client.query(`
          INSERT INTO outlet_stocks (outlet_id, item_id, current_balance)
          VALUES ($1, $2, 0)
          ON CONFLICT (outlet_id, item_id) DO NOTHING
        `, [outletId, ing.ingredient_id]);

        // Lock and deduct
        const stockRes = await client.query(`
          UPDATE outlet_stocks
          SET current_balance = current_balance - $3, updated_at = NOW()
          WHERE outlet_id = $1 AND item_id = $2
          RETURNING current_balance
        `, [outletId, ing.ingredient_id, qtyToDeduct]);

        const newBalance = stockRes.rows[0].current_balance;

        // Log deduction
        await client.query(`
          INSERT INTO outlet_inventory_logs 
          (outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type)
          VALUES ($1, $2, 'SALES', $3, $4, 'MOKA_SALES')
        `, [outletId, ing.ingredient_id, -qtyToDeduct, newBalance]);
        
        totalIngredientsDeducted++;
      }
    }

    // Mark as deducted
    await client.query(`
      UPDATE moka_transactions
      SET is_stock_deducted = true
      WHERE id = ANY($1)
    `, [trxIds]);

    return { 
      count: trxIds.length, 
      itemsDeducted: itemsRes.rows.length,
      ingredientsDeducted: totalIngredientsDeducted 
    };
  });
}

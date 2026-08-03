import { query, withTransaction } from '../db';

/**
 * outlet_inventory_logs.movement_type valid values (not documented in DB — tracked here):
 *   'IN'    — Penerimaan barang dari Delivery Order (processPublicReceive)
 *   'ADJ'   — Penyesuaian dari Stock Opname Outlet (lockStockCount OUTLET)
 *   'SALES' — Pemotongan otomatis dari penjualan Moka POS (deductOutletStockFromSales)
 *
 * outlet_inventory_logs.reference_type valid values:
 *   'PUBLIC_RECEIVE'    — Konfirmasi penerimaan DO oleh outlet
 *   'OPNAME_ADJUSTMENT' — Penyesuaian dari stock opname outlet
 *   'MOKA_SALES'        — Pemotongan bahan dari transaksi Moka POS
 */

export type OutletStockRow = {
  item_id: number;
  item_name: string;
  category_name: string;
  current_balance: number;
  purchase_unit: string;
  smallest_unit: string;
  minimum_threshold: number | null;
  target_stock: number;
  barcode: string | null;
  incoming_balance?: number;
  conversion_ratio?: number;
  has_stock_history?: boolean;
  is_custom_threshold?: boolean;
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
      i.target_stock,
      COALESCE(os.current_balance, 0)::numeric AS current_balance,
      (os.outlet_id IS NOT NULL) AS has_stock_history,
      (ois.minimum_threshold IS NOT NULL) AS is_custom_threshold,
      COALESCE(ois.minimum_threshold, i.minimum_threshold) AS minimum_threshold,
      (
        SELECT COALESCE(SUM(COALESCE(oi.approved_smallest_qty, oi.smallest_unit_qty)), 0)
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.outlet_id = $1 AND oi.item_id = i.id 
          AND oi.item_status IN ('PROSES_BELANJA', 'READY_DI_GUDANG', 'DIKIRIM')
          AND o.status NOT IN ('COMPLETED', 'CANCELLED', 'DIBATALKAN')
      )::numeric AS incoming_balance
    FROM items i
    LEFT JOIN categories c ON c.id = i.category_id
    LEFT JOIN outlet_stocks os ON os.item_id = i.id AND os.outlet_id = $1
    LEFT JOIN outlet_item_settings ois ON ois.item_id = i.id AND ois.outlet_id = $1
    LEFT JOIN ingredients ing ON (ing.id = i.ingredient_id OR ing.item_id = i.id)
    LEFT JOIN recipe_ingredients ri ON ri.ingredient_id = ing.id
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
    const unmatchedMenus: string[] = [];

    for (const item of itemsRes.rows) {
      const qtySold = Number(item.total_qty);
      if (qtySold <= 0) continue;

      // Cari bahan-bahan dari resep menu ini, difilter hanya dari venue yang dimiliki outlet ini.
      // JOIN outlet_venues memastikan resep dari outlet/venue lain tidak ikut terhitung (cross-venue contamination).
      const ingRes = await client.query(`
        SELECT i.id as ingredient_id, SUM(ri.quantity) as quantity
        FROM menus m
        JOIN recipes r ON r.menu_id = m.id
        JOIN outlet_venues ov ON ov.venue_id = r.venue_id AND ov.outlet_id = $2
        JOIN recipe_ingredients ri ON ri.recipe_id = r.id
        JOIN ingredients ing ON ing.id = ri.ingredient_id
        JOIN items i ON (i.id = ing.item_id OR i.ingredient_id = ing.id)
        WHERE (
          LOWER(TRIM(m.name)) = LOWER(TRIM($1))
          OR (m.display_name IS NOT NULL AND m.display_name <> '' AND LOWER(TRIM(m.display_name)) = LOWER(TRIM($1)))
          OR (
            m.name IS NOT NULL AND m.name <> ''
            AND m.variant IS NOT NULL AND m.variant <> ''
            AND LOWER(TRIM($1)) LIKE LOWER(TRIM(m.name)) || ' %'
            AND LOWER(TRIM($1)) LIKE '%' || LOWER(TRIM(m.variant))
          )
        )
        GROUP BY i.id
      `, [item.item_name, outletId]);

      if (ingRes.rows.length === 0) {
        unmatchedMenus.push(item.item_name);
      }

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
      ingredientsDeducted: totalIngredientsDeducted,
      unmatchedMenus
    };
  });
}

/**
 * Membaca data penjualan dari moka_item_sales untuk periode tertentu,
 * lalu menghitung & menulis pemotongan bahan ke outlet_inventory_logs.
 * Dijalankan otomatis setelah sync moka_item_sales agar kolom OUT dan LIVE real-time.
 * 
 * Idempotent: hapus log MOKA_SALES_REPORT lama untuk outlet+periode ini sebelum insert ulang.
 */
export async function deductFromMokaItemSales(outletId: number, startDate: string, endDate: string) {
  return withTransaction(async (client) => {
    // 1. Ambil data penjualan dari moka_item_sales untuk periode ini
    const salesRes = await client.query(`
      SELECT name, COALESCE(SUM(item_sold - item_refunded), 0) AS net_sold
      FROM moka_item_sales
      WHERE outlet_id = $1
        AND period_start = $2
        AND period_end = $3
      GROUP BY name
    `, [outletId, startDate, endDate]);

    if (salesRes.rows.length === 0) return { count: 0, ingredientsDeducted: 0 };

    // 2. Hapus log lama reference_type=MOKA_SALES_REPORT untuk outlet+periode ini
    //    Gunakan hash numerik dari outletId+startDate+endDate sebagai reference_id.
    const periodHash = BigInt(outletId) * BigInt(100000000) + BigInt(startDate.replace(/-/g, '')) % BigInt(100000);
    const refId = Number(periodHash);

    await client.query(`
      DELETE FROM outlet_inventory_logs
      WHERE outlet_id = $1
        AND reference_type = 'MOKA_SALES_REPORT'
        AND reference_id = $2
    `, [outletId, refId]);

    let totalIngredientsDeducted = 0;
    const ingredientTotals: Record<number, number> = {};

    // 3. Hitung total pemotongan per bahan dari resep
    for (const sale of salesRes.rows) {
      const netSold = Number(sale.net_sold);
      if (netSold <= 0) continue;

      // Cari bahan-bahan dari resep menu ini, difilter hanya dari venue yang dimiliki outlet ini.
      // JOIN outlet_venues memastikan resep dari outlet/venue lain tidak ikut terhitung (cross-venue contamination).
      const ingRes = await client.query(`
        SELECT i.id AS ingredient_id, ri.quantity
        FROM menus m
        JOIN recipes r ON r.menu_id = m.id
        JOIN outlet_venues ov ON ov.venue_id = r.venue_id AND ov.outlet_id = $2
        JOIN recipe_ingredients ri ON ri.recipe_id = r.id
        JOIN ingredients ing ON ing.id = ri.ingredient_id
        JOIN items i ON (i.id = ing.item_id OR i.ingredient_id = ing.id)
        WHERE LOWER(TRIM(m.name)) = LOWER(TRIM($1))
           OR (m.display_name IS NOT NULL AND m.display_name <> '' AND LOWER(TRIM(m.display_name)) = LOWER(TRIM($1)))
           OR (
             m.name IS NOT NULL AND m.name <> '' 
             AND m.variant IS NOT NULL AND m.variant <> ''
             AND LOWER(TRIM($1)) LIKE LOWER(TRIM(m.name)) || ' %'
             AND LOWER(TRIM($1)) LIKE '%' || LOWER(TRIM(m.variant))
           )
      `, [sale.name, outletId]);

      for (const ing of ingRes.rows) {
        const qtyToDeduct = Number(ing.quantity) * netSold;
        ingredientTotals[ing.ingredient_id] = (ingredientTotals[ing.ingredient_id] || 0) + qtyToDeduct;
      }
    }

    // 4. Terapkan pemotongan ke outlet_stocks dan catat ke outlet_inventory_logs
    for (const [ingredientIdStr, totalDeduct] of Object.entries(ingredientTotals)) {
      const ingredientId = Number(ingredientIdStr);
      if (totalDeduct <= 0) continue;

      // Pastikan record ada di outlet_stocks
      await client.query(`
        INSERT INTO outlet_stocks (outlet_id, item_id, current_balance)
        VALUES ($1, $2, 0)
        ON CONFLICT (outlet_id, item_id) DO NOTHING
      `, [outletId, ingredientId]);

      // Potong stok
      const stockRes = await client.query(`
        UPDATE outlet_stocks
        SET current_balance = current_balance - $3, updated_at = NOW()
        WHERE outlet_id = $1 AND item_id = $2
        RETURNING current_balance
      `, [outletId, ingredientId, totalDeduct]);

      const newBalance = Number(stockRes.rows[0]?.current_balance ?? 0);

      // Catat log dengan reference_type MOKA_SALES_REPORT dan reference_id = period hash
      await client.query(`
        INSERT INTO outlet_inventory_logs
        (outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type, reference_id)
        VALUES ($1, $2, 'SALES', $3, $4, 'MOKA_SALES_REPORT', $5)
      `, [outletId, ingredientId, -totalDeduct, newBalance, refId]);

      totalIngredientsDeducted++;
    }

    return {
      count: salesRes.rows.length,
      ingredientsDeducted: totalIngredientsDeducted
    };
  });
}

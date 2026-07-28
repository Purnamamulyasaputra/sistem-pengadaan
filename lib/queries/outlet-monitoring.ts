import { query } from '../db';

export interface OutletMonitoringOutlet {
  id: number;
  name: string;
  last_request_date: string | null;
  last_do_date: string | null;
  last_sales_sync: string | null;
}

export interface OutletMonitoringItem {
  id: number;
  name: string;
  barcode: string | null;
  category_id: number;
  purchase_unit: string;
  smallest_unit: string;
  conversion_ratio: number;
  minimum_threshold: number;
  is_active: boolean;
  central_stock: number;
  current_average_price: number;
}

export interface OutletMonitoringCategory {
  id: number;
  name: string;
}

export interface ConsumedMaterial {
  item_id: number;
  item_name: string;
  smallest_unit: string;
  purchase_unit: string;
  conversion_ratio: number;
  total_consumed_smallest: number;
  consumed_display: string;
}

export interface SoldProduct {
  name: string;
  category_name: string;
  item_sold: number;
  net_sales: number;
}

export interface OutletConsumptionSummary {
  outlet_id: number;
  last_do_date: string | null;
  last_request_date: string | null;
  total_revenue: number;
  total_qty_sold: number;
  consumed_materials: ConsumedMaterial[];
  sold_products: SoldProduct[];
  period_start_date: string;
}

/**
 * Mengambil data pemantauan stok outlet secara lengkap, termasuk waktu aktivitas terakhir per outlet.
 */
export async function getOutletMonitoringData() {
  // 1. Ambil semua outlet aktif (STORE) dengan tanggal aktivitas terakhir
  const outletsRes = await query<OutletMonitoringOutlet>(`
    SELECT 
      o.id, 
      o.name,
      (SELECT MAX(created_at) FROM orders WHERE outlet_id = o.id) AS last_request_date,
      (SELECT MAX(delivery_date) FROM delivery_notes WHERE outlet_id = o.id AND status != 'CANCELLED') AS last_do_date,
      (SELECT MAX(period_end) FROM moka_item_sales WHERE outlet_id = o.id) AS last_sales_sync
    FROM outlets o
    WHERE o.type = 'STORE'
    ORDER BY o.name ASC
  `);

  // 2. Ambil semua barang aktif beserta stok pusat saat ini
  const itemsRes = await query<OutletMonitoringItem>(`
    SELECT 
      i.id, 
      i.name, 
      i.barcode,
      i.category_id,
      i.purchase_unit, 
      i.smallest_unit,
      i.conversion_ratio,
      i.minimum_threshold,
      i.is_active,
      COALESCE((
        SELECT ending_balance 
        FROM inventory_logs 
        WHERE item_id = i.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ), 0) AS central_stock,
      COALESCE(i.current_average_price, 0) AS current_average_price
    FROM items i
    WHERE i.is_active = TRUE
    ORDER BY i.name ASC
  `);

  // 3. Ambil seluruh stok live outlet dari tabel outlet_stocks
  const outletStocksRes = await query<{ item_id: number; outlet_id: number; current_balance: string }>(`
    SELECT 
      item_id, 
      outlet_id, 
      current_balance 
    FROM outlet_stocks
  `);

  // Bentuk dictionary agar mudah dibaca di frontend: map[item_id][outlet_id] = current_balance
  const stockMatrix: Record<number, Record<number, number>> = {};
  for (const row of outletStocksRes.rows) {
    if (!stockMatrix[row.item_id]) stockMatrix[row.item_id] = {};
    stockMatrix[row.item_id][row.outlet_id] = parseFloat(row.current_balance);
  }

  const catRes = await query<OutletMonitoringCategory>(`SELECT id, name FROM categories ORDER BY name ASC`);

  return {
    outlets: outletsRes.rows,
    items: itemsRes.rows,
    stockMatrix,
    categories: catRes.rows
  };
}

/**
 * Mengambil ringkasan konsumsi bahan baku dan penjualan sejak tanggal pengiriman/pengadaan terakhir untuk sebuah outlet.
 */
export async function getOutletConsumptionSinceLastRestock(outletId: number): Promise<OutletConsumptionSummary> {
  // 1. Cari tanggal pengiriman terakhir (DO) ke outlet ini
  const doRes = await query<{ last_do_date: string | null }>(`
    SELECT MAX(delivery_date) AS last_do_date
    FROM delivery_notes
    WHERE outlet_id = $1 AND status != 'CANCELLED'
  `, [outletId]);

  const reqRes = await query<{ last_request_date: string | null }>(`
    SELECT MAX(created_at) AS last_request_date
    FROM orders
    WHERE outlet_id = $1
  `, [outletId]);

  const lastDoDate = doRes.rows[0]?.last_do_date || null;
  const lastRequestDate = reqRes.rows[0]?.last_request_date || null;

  // Tentukan tanggal acuan penghitungan (jika belum pernah DO, gunakan 30 hari ke belakang)
  let sinceDateStr: string;
  if (lastDoDate) {
    const d = new Date(lastDoDate);
    sinceDateStr = d.toISOString().split('T')[0];
  } else {
    const d = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    sinceDateStr = d.toISOString().split('T')[0];
  }

  // 2. Hitung total penjualan dari tabel moka_item_sales sejak tanggal acuan
  const salesRes = await query<{ total_revenue: string; total_qty: string }>(`
    SELECT 
      COALESCE(SUM(net_sales), 0) AS total_revenue,
      COALESCE(SUM(item_sold), 0) AS total_qty
    FROM moka_item_sales
    WHERE outlet_id = $1 AND period_start >= $2
  `, [outletId, sinceDateStr]);

  const totalRevenue = parseFloat(salesRes.rows[0]?.total_revenue || '0');
  const totalQtySold = parseFloat(salesRes.rows[0]?.total_qty || '0');

  // 3. Ambil daftar bahan baku yang dihabiskan dari tabel outlet_inventory_logs (movement_type = 'SALES')
  // sejak tanggal acuan
  const consumedRes = await query<{
    item_id: number;
    item_name: string;
    smallest_unit: string;
    purchase_unit: string;
    conversion_ratio: string;
    total_consumed_smallest: string;
  }>(`
    SELECT 
      i.id AS item_id,
      i.name AS item_name,
      i.smallest_unit,
      i.purchase_unit,
      i.conversion_ratio,
      COALESCE(ABS(SUM(il.qty_change)), 0) AS total_consumed_smallest
    FROM outlet_inventory_logs il
    JOIN items i ON i.id = il.item_id
    WHERE il.outlet_id = $1 
      AND il.movement_type = 'SALES'
      AND il.created_at >= $2::timestamp
    GROUP BY i.id, i.name, i.smallest_unit, i.purchase_unit, i.conversion_ratio
    HAVING ABS(SUM(il.qty_change)) > 0
    ORDER BY total_consumed_smallest DESC
    LIMIT 20
  `, [outletId, `${sinceDateStr} 00:00:00`]);

  const consumed_materials: ConsumedMaterial[] = consumedRes.rows.map(row => {
    const totalSmallest = parseFloat(row.total_consumed_smallest || '0');
    const ratio = parseFloat(row.conversion_ratio || '1') || 1;
    let displayStr = '';

    if (ratio > 1 && row.purchase_unit && row.purchase_unit !== row.smallest_unit) {
      const inPurchase = parseFloat((totalSmallest / ratio).toFixed(1));
      displayStr = `${inPurchase} ${row.purchase_unit}`;
    } else {
      displayStr = `${totalSmallest} ${row.smallest_unit || ''}`;
    }

    return {
      item_id: row.item_id,
      item_name: row.item_name,
      smallest_unit: row.smallest_unit || '',
      purchase_unit: row.purchase_unit || '',
      conversion_ratio: ratio,
      total_consumed_smallest: totalSmallest,
      consumed_display: displayStr
    };
  });

  // 4. Ambil daftar produk yang terjual dari moka_item_sales sejak tanggal acuan
  const soldProductsRes = await query<{
    name: string;
    category_name: string;
    item_sold: string;
    net_sales: string;
  }>(`
    SELECT 
      name,
      COALESCE(category_name, 'Lainnya') AS category_name,
      COALESCE(SUM(item_sold), 0) AS item_sold,
      COALESCE(SUM(net_sales), 0) AS net_sales
    FROM moka_item_sales
    WHERE outlet_id = $1 AND period_start >= $2
    GROUP BY name, category_name
    HAVING COALESCE(SUM(item_sold), 0) > 0
    ORDER BY SUM(item_sold) DESC
    LIMIT 50
  `, [outletId, sinceDateStr]);

  const sold_products: SoldProduct[] = soldProductsRes.rows.map(row => ({
    name: row.name,
    category_name: row.category_name,
    item_sold: parseInt(row.item_sold || '0', 10),
    net_sales: parseFloat(row.net_sales || '0'),
  }));

  return {
    outlet_id: outletId,
    last_do_date: lastDoDate,
    last_request_date: lastRequestDate,
    total_revenue: totalRevenue,
    total_qty_sold: totalQtySold,
    consumed_materials,
    sold_products,
    period_start_date: sinceDateStr
  };
}

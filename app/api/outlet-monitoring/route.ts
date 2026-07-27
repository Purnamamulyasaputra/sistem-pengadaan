import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Ambil semua outlet aktif (kecuali pusat)
    const outletsRes = await query(`
      SELECT id, name 
      FROM outlets 
      WHERE type = 'STORE'
      ORDER BY name ASC
    `);
    const outlets = outletsRes.rows;

    // 2. Ambil semua barang yang ditrack stoknya beserta stok pusat saat ini
    const itemsRes = await query(`
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
        ), 0) AS central_stock
      FROM items i
      WHERE i.is_active = TRUE
      ORDER BY i.name ASC
    `);
    const items = itemsRes.rows;

    // 3. Ambil seluruh stok live outlet dari tabel outlet_stocks
    const outletStocksRes = await query(`
      SELECT 
        item_id, 
        outlet_id, 
        current_balance 
      FROM outlet_stocks
    `);
    
    // Bentuk dictionary agar mudah dibaca di frontend
    // map[item_id][outlet_id] = current_balance
    const stockMatrix: Record<number, Record<number, number>> = {};
    for (const row of outletStocksRes.rows) {
      if (!stockMatrix[row.item_id]) stockMatrix[row.item_id] = {};
      stockMatrix[row.item_id][row.outlet_id] = parseFloat(row.current_balance);
    }

    const catRes = await query(`SELECT id, name FROM categories ORDER BY name ASC`);
    const categories = catRes.rows;

    return NextResponse.json({
      success: true,
      data: {
        outlets,
        items,
        stockMatrix,
        categories
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching outlet monitoring:', error);
    return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}

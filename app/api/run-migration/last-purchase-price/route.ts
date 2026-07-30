/**
 * ONE-TIME Migration API Route
 * Akses: POST /api/run-migration/last-purchase-price
 * 
 * HAPUS file ini setelah migration berhasil dijalankan.
 * Hanya bisa dijalankan oleh ADMIN_PUSAT.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST() {
  const session = await getSession();
  if (session?.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Tambah kolom last_purchase_price
    await query(`
      ALTER TABLE items
        ADD COLUMN IF NOT EXISTS last_purchase_price NUMERIC(15,4) DEFAULT 0
    `);

    // 2. Backfill dari price_history (harga pembelian terakhir per item)
    const backfill = await query(`
      UPDATE items i
      SET last_purchase_price = ph.unit_purchase_price / NULLIF(i.conversion_ratio, 0)
      FROM (
        SELECT DISTINCT ON (item_id)
          item_id,
          unit_purchase_price,
          purchase_date
        FROM price_history
        ORDER BY item_id, purchase_date DESC, id DESC
      ) ph
      WHERE ph.item_id = i.id
        AND i.last_purchase_price = 0
    `);

    // 3. Fallback: item tanpa histori → pakai current_average_price
    const fallback = await query(`
      UPDATE items
      SET last_purchase_price = current_average_price
      WHERE last_purchase_price = 0
        AND current_average_price > 0
    `);

    // Verifikasi
    const verify = await query(`
      SELECT COUNT(*) AS total_items,
             COUNT(NULLIF(last_purchase_price, 0)) AS items_with_price
      FROM items
    `);

    return NextResponse.json({
      success: true,
      message: 'Migration berhasil!',
      backfilled_from_price_history: backfill.rowCount,
      backfilled_from_avg_price: fallback.rowCount,
      verification: verify.rows[0],
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 });
  }
}

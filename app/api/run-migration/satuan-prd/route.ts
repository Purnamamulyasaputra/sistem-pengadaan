import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST() {
  const session = await getSession();
  if (session?.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Tambah kolom di tabel items
    await query(`
      ALTER TABLE items
        ADD COLUMN IF NOT EXISTS is_split_allowed BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS min_order_qty NUMERIC(10,2) NOT NULL DEFAULT 1.00,
        ADD COLUMN IF NOT EXISTS order_multiple NUMERIC(10,2) NOT NULL DEFAULT 1.00
    `);

    // 2. Tambah kolom di tabel order_items (PO snapshot)
    await query(`
      ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS conversion_ratio NUMERIC(10,2) NOT NULL DEFAULT 1.00
    `);

    // 3. Tambah kolom di tabel delivery_note_items (DO snapshot)
    await query(`
      ALTER TABLE delivery_note_items
        ADD COLUMN IF NOT EXISTS conversion_ratio NUMERIC(10,2) NOT NULL DEFAULT 1.00
    `);

    // 4. Backfill conversion_ratio di order_items dari tabel items untuk data lama
    const bfOrderItems = await query(`
      UPDATE order_items oi
      SET conversion_ratio = COALESCE(i.conversion_ratio, 1.00)
      FROM items i
      WHERE oi.item_id = i.id
        AND oi.conversion_ratio = 1.00
        AND i.conversion_ratio > 1.00
    `);

    // 5. Backfill conversion_ratio di delivery_note_items dari tabel items untuk data lama
    const bfDoItems = await query(`
      UPDATE delivery_note_items dni
      SET conversion_ratio = COALESCE(i.conversion_ratio, 1.00)
      FROM items i
      WHERE dni.item_id = i.id
        AND dni.conversion_ratio = 1.00
        AND i.conversion_ratio > 1.00
    `);

    return NextResponse.json({
      success: true,
      message: 'Migration Satuan PRD berhasil dijalankan!',
      backfilled_order_items: bfOrderItems.rowCount,
      backfilled_do_items: bfDoItems.rowCount,
    });
  } catch (err: unknown) {
    console.error('Migration error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

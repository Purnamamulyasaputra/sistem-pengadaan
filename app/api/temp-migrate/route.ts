import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fix: Update order_items to SELESAI for all items linked to DITERIMA delivery notes
    await query(`
      UPDATE order_items oi
      SET item_status = 'SELESAI', updated_at = NOW()
      FROM delivery_note_items dni
      JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
      WHERE dni.order_item_id = oi.id
        AND dn.status = 'DITERIMA'
        AND oi.item_status != 'SELESAI'
    `);

    // Fix: Update orders to COMPLETED where all order_items are SELESAI
    await query(`
      UPDATE orders o
      SET status = 'COMPLETED', updated_at = NOW()
      WHERE o.status NOT IN ('COMPLETED', 'DIBATALKAN')
        AND NOT EXISTS (
          SELECT 1 FROM order_items oi
          WHERE oi.order_id = o.id AND oi.item_status != 'SELESAI'
        )
        AND EXISTS (
          SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
        )
    `);

    // Fix: Update orders to SHIPPED where some (not all) items are SELESAI
    await query(`
      UPDATE orders o
      SET status = 'SHIPPED', updated_at = NOW()
      WHERE o.status = 'PROCESSING'
        AND EXISTS (
          SELECT 1 FROM order_items oi
          WHERE oi.order_id = o.id AND oi.item_status = 'SELESAI'
        )
        AND EXISTS (
          SELECT 1 FROM order_items oi
          WHERE oi.order_id = o.id AND oi.item_status != 'SELESAI'
        )
    `);

    return NextResponse.json({ success: true, message: 'Status orders berhasil diperbaiki.' });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: (e instanceof Error ? e.message : 'Unknown error') });
  }
}

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    await query(`ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS proof_image_url VARCHAR;`);
    await query(`ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS qty_received NUMERIC;`);
    await query(`ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS discrepancy_reason VARCHAR;`);
    await query(`ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS discrepancy_notes TEXT;`);
    await query(`ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS unique_barcode VARCHAR;`);
    return NextResponse.json({ success: true, message: 'Altered successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}

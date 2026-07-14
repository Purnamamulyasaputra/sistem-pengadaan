import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    await query(`
      ALTER TABLE delivery_note_items 
      ADD COLUMN IF NOT EXISTS qty_received NUMERIC(10,3),
      ADD COLUMN IF NOT EXISTS discrepancy_reason VARCHAR(100),
      ADD COLUMN IF NOT EXISTS discrepancy_notes TEXT;
    `);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}

import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await query(`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS item_id BIGINT REFERENCES items(id) ON DELETE SET NULL;`);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}

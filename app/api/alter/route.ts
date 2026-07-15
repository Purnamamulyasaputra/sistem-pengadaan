import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    await query(`ALTER TABLE items ADD COLUMN package_unit VARCHAR(50)`);
    await query(`ALTER TABLE items ADD COLUMN package_qty INT`);
    return NextResponse.json({ success: true, message: 'Columns added' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message });
  }
}

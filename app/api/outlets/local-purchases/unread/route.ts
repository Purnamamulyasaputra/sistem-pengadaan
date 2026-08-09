import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const res = await query(`SELECT COUNT(*) as count FROM outlet_local_purchases WHERE is_read_by_central = false`);
    const count = parseInt(res.rows[0].count, 10);
    
    return NextResponse.json({ success: true, count });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

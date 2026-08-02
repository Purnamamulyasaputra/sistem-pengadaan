import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.outletId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT DISTINCT oi.item_id 
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.outlet_id = $1 
         AND o.status NOT IN ('COMPLETED', 'CANCELLED', 'DIBATALKAN')
         AND oi.item_status NOT IN ('SELESAI', 'DIBATALKAN')`,
      [session.outletId]
    );

    const activeItemIds = result.rows.map(r => r.item_id);

    return NextResponse.json({ success: true, data: activeItemIds });
  } catch (err: unknown) {
    console.error('Error fetching active requested items:', err);
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}

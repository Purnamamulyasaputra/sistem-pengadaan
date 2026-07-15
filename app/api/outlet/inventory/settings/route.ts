import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.outletId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId, minimumThreshold } = await request.json();

    if (!itemId) {
      return NextResponse.json({ error: 'Missing item ID' }, { status: 400 });
    }

    // Upsert the setting
    await query(`
      INSERT INTO outlet_item_settings (outlet_id, item_id, minimum_threshold, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (outlet_id, item_id) DO UPDATE 
      SET minimum_threshold = EXCLUDED.minimum_threshold,
          updated_at = NOW()
    `, [session.outletId, itemId, minimumThreshold]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

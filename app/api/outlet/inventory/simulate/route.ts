import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withTransaction } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.outletId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId, amount } = await request.json();

    if (!itemId || !amount) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    await withTransaction(async (client) => {
      // Check if stock exists
      const stockRes = await client.query(`
        SELECT current_balance FROM outlet_stocks 
        WHERE outlet_id = $1 AND item_id = $2 FOR UPDATE
      `, [session.outletId, itemId]);

      let newBal: number;

      if (stockRes.rows.length === 0) {
        newBal = -amount;
        await client.query(`
          INSERT INTO outlet_stocks (outlet_id, item_id, current_balance, updated_at) 
          VALUES ($1, $2, $3, NOW())
        `, [session.outletId, itemId, newBal]);
      } else {
        newBal = Number(stockRes.rows[0].current_balance) - amount;
        await client.query(`
          UPDATE outlet_stocks SET current_balance = $1, updated_at = NOW() 
          WHERE outlet_id = $2 AND item_id = $3
        `, [newBal, session.outletId, itemId]);
      }

      // Log the movement (using correct column names)
      await client.query(`
        INSERT INTO outlet_inventory_logs (outlet_id, item_id, movement_type, qty_change, ending_balance, reference_type)
        VALUES ($1, $2, 'OUT', $3, $4, 'SIMULATION')
      `, [session.outletId, itemId, -amount, newBal]);
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[simulate]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { withTransaction } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { items } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Data stok kosong' }, { status: 400 });
    }

    await withTransaction(async (client) => {
      for (const item of items) {
        // Validate payload
        const item_id = Number(item.item_id);
        const actual_qty = Number(item.actual_qty);

        if (isNaN(item_id) || isNaN(actual_qty) || actual_qty <= 0) {
          continue; // Skip invalid rows gracefully
        }

        // Retrieve current conversion ratio to store in smallest unit or just use purchase unit?
        // In our system, ending_balance in inventory_logs is usually in Smallest Unit for Central Warehouse.
        // Wait, the client usually inputs in Purchase Unit for easier counting. Let's get the ratio.
        const resItem = await client.query('SELECT conversion_ratio, current_average_price FROM items WHERE id = $1', [item_id]);
        if (resItem.rowCount === 0) continue;
        
        const ratio = Number(resItem.rows[0].conversion_ratio || 1);
        const qty_in_smallest_unit = actual_qty * ratio;

        // Check if there is already an existing log for this item
        const resLastLog = await client.query(
          'SELECT ending_balance FROM inventory_logs WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1',
          [item_id]
        );
        
        const existingStock = (resLastLog.rowCount ?? 0) > 0 ? Number(resLastLog.rows[0].ending_balance) : 0;
        
        // Only insert if the qty_change isn't 0. Wait, if it's Opening Balance, maybe we just overwrite the stock?
        // Actually, Opening Balance should just insert the total amount directly (or as a positive adjustment).
        // If stock is already 0, qty_change = qty_in_smallest_unit. 
        // If stock is already > 0, we can calculate qty_change to reach actual_qty.
        const qty_change = qty_in_smallest_unit - existingStock;

        if (qty_change !== 0) {
          await client.query(
            `INSERT INTO inventory_logs 
             (item_id, movement_type, qty_change, ending_balance, reference_type, reference_id) 
             VALUES ($1, $2, $3, $4, 'OB', NULL)`,
            [item_id, qty_change > 0 ? 'IN' : 'OUT', qty_change, qty_in_smallest_unit]
          );
        }
      }
    });

    return NextResponse.json({ success: true, message: 'Migrasi stok awal berhasil dieksekusi' });
  } catch (err: unknown) {
    console.error('Opening Balance Error:', err);
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}

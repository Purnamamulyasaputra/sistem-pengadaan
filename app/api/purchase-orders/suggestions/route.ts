import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });

  // Ambil semua barang aktif yang stok saat ininya <= minimum_threshold
  // Kita hitung current_balance dari inventory_logs, jika tidak ada log maka 0
  const result = await query(`
    WITH item_balances AS (
      SELECT 
        i.id as item_id, 
        i.name as item_name, 
        c.name as category_name,
        i.smallest_unit, 
        i.minimum_threshold,
        COALESCE((
          SELECT ending_balance 
          FROM inventory_logs 
          WHERE item_id = i.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ), 0) as current_balance
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.is_active = TRUE
    )
    SELECT * 
    FROM item_balances
    WHERE current_balance <= COALESCE(minimum_threshold, 0)
    ORDER BY current_balance ASC, item_name ASC;
  `);

  return NextResponse.json({ success: true, message: 'OK', data: result.rows });
}

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    
    let sql = `
      SELECT 
        i.id, i.name as item_name, c.name as category_name, 
        i.smallest_unit, i.purchase_unit, i.conversion_ratio,
        COALESCE((SELECT ending_balance FROM inventory_logs il WHERE il.item_id = i.id ORDER BY il.created_at DESC LIMIT 1), 0)::numeric AS central_stock,
        COALESCE((SELECT SUM(current_balance) FROM outlet_stocks os WHERE os.item_id = i.id), 0)::numeric AS outlet_stock,
        i.current_average_price
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      WHERE i.is_active = TRUE
    `;
    
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND i.name ILIKE $1`;
    }
    
    sql += ` ORDER BY i.name ASC`;
    
    const res = await query(sql, params);
    
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error fetching combined stock:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data report stok gabungan' }, { status: 500 });
  }
}

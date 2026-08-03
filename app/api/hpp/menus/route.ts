import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session?.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { category_id, name, variant, sale_price } = body;

    if (!category_id || !name || sale_price == null) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const res = await query(
      `INSERT INTO menus (category_id, name, variant, sale_price, display_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        parseInt(category_id),
        name,
        variant || null,
        parseFloat(sale_price),
        variant ? `${name} - ${variant}` : name
      ]
    );

    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error: any) {
    console.error('Error creating menu:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}

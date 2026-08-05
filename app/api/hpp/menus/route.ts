import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createMenu } from '@/lib/queries/hpp';

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

    const displayName = variant ? `${name} - ${variant}` : name;
    
    const menuRow = await createMenu(
      parseInt(category_id),
      name,
      variant || null,
      parseFloat(sale_price),
      displayName
    );

    return NextResponse.json({ success: true, data: menuRow });
  } catch (error: any) {
    console.error('Error creating menu:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}

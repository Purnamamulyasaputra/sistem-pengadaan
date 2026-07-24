import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getItems, createItem, generateBarcode } from '@/lib/queries/items';
import { getCategories } from '@/lib/queries/master';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const items = await getItems({
    categoryId: searchParams.get('category_id') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    activeOnly: searchParams.get('active_only') !== 'false',
  });
  return NextResponse.json({ success: true, message: 'OK', data: items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  }

  const body = await req.json();
  const { name, category_id, purchase_unit, smallest_unit, conversion_ratio, minimum_threshold, threshold_type, is_perishable, current_average_price, ingredient_id } = body;

  if (!name || !category_id || !purchase_unit || !smallest_unit) {
    return NextResponse.json({ success: false, message: 'Field wajib tidak lengkap', data: null }, { status: 400 });
  }

  try {
    const item = await createItem({
      name, category_id: Number(category_id), purchase_unit, smallest_unit,
      conversion_ratio: Number(conversion_ratio ?? 1),
      minimum_threshold: Number(minimum_threshold ?? 0),
      threshold_type: threshold_type ?? 'ABSOLUT',
      is_perishable: Boolean(is_perishable),
      current_average_price: Number(current_average_price ?? 0),
      ingredient_id: ingredient_id ? Number(ingredient_id) : null,
    });

    // Auto-generate barcode
    if (!item.barcode) {
      await generateBarcode(item.id);
      item.barcode = `ERC${String(item.id).padStart(6, '0')}`;
    }

    return NextResponse.json({ success: true, message: 'Item berhasil ditambahkan', data: item }, { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, message: 'Gagal menambahkan: Barcode sudah digunakan oleh barang lain.', data: null }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Gagal menambahkan: ' + error.message, data: null }, { status: 500 });
  }
}

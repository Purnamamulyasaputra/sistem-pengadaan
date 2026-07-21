import { NextResponse } from 'next/server';
import { getProductSalesMatrix } from '@/lib/queries/sales-transactions';
import { getOutlets } from '@/lib/queries/master';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const categoryId = searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId') as string) : undefined;
    const search = searchParams.get('search') || undefined;

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ success: false, message: 'Date range is required' }, { status: 400 });
    }

    const [matrix, outlets, categoriesRes] = await Promise.all([
      getProductSalesMatrix(dateFrom, dateTo, categoryId, search),
      getOutlets(),
      query(`SELECT id, name FROM menu_categories ORDER BY name`),
    ]);

    // Format the columns based on outlets
    const outletColumns = outlets
      .filter((o) => o.type !== 'CENTRAL_KITCHEN' && o.type !== 'SUPPLIER')
      .map((o) => ({ id: o.id, name: o.name }));

    return NextResponse.json({
      success: true,
      data: {
        matrix,
        outletColumns,
        categories: categoriesRes.rows,
      },
    });
  } catch (error: any) {
    console.error('Error fetching product sales matrix:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

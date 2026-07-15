import { NextRequest, NextResponse } from 'next/server';
import { getHppMenus, getHppVenues, getHppCategories, getHppVsSale } from '@/lib/queries/hpp';
import { getOutletHppMenus } from '@/lib/queries/outlet-menus';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tab = searchParams.get('tab') ?? 'menus'; // menus | margin
  const categoryId = searchParams.get('category_id');
  const marginFlag = searchParams.get('margin_flag');
  const search = searchParams.get('search') ?? undefined;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = (page - 1) * limit;

  try {
    const session = await getSession();
    const isOutlet = session?.role === 'ADMIN_OUTLET' && session.outletId;

    if (tab === 'margin') {
      const data = await getHppVsSale({
        marginFlag: marginFlag ?? undefined,
        category: categoryId ? undefined : undefined,
      });
      return NextResponse.json({ data });
    }

    const menusPromise = isOutlet 
      ? getOutletHppMenus(session.outletId as number, {
          categoryId: categoryId ? parseInt(categoryId) : undefined,
          marginFlag: marginFlag ?? undefined,
          search,
          limit,
          offset,
        })
      : getHppMenus({
          categoryId: categoryId ? parseInt(categoryId) : undefined,
          marginFlag: marginFlag ?? undefined,
          search,
          limit,
          offset,
        });

    const [menusResult, venues, categories] = await Promise.all([
      menusPromise,
      getHppVenues(),
      getHppCategories(),
    ]);

    return NextResponse.json({
      data: menusResult.data,
      total: menusResult.total,
      page,
      limit,
      venues,
      categories,
    });
  } catch (err) {
    console.error('[GET /api/hpp] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

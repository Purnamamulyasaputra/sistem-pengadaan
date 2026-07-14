import { NextRequest, NextResponse } from 'next/server';
import { getHppRecipes, getHppKitchenSummary, createRecipe } from '@/lib/queries/hpp';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const venueId = searchParams.get('venue_id');
  const sourceSheet = searchParams.get('source_sheet');
  const search = searchParams.get('search') ?? undefined;
  const tab = searchParams.get('tab') ?? 'list';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = (page - 1) * limit;

  try {
    if (tab === 'kitchen') {
      const data = await getHppKitchenSummary();
      return NextResponse.json({ data });
    }

    const result = await getHppRecipes({
      venueId: venueId ? parseInt(venueId) : undefined,
      sourceSheet: sourceSheet ?? undefined,
      search,
      limit,
      offset,
    });

    return NextResponse.json({
      data: result.data,
      total: result.total,
      page,
      limit,
    });
  } catch (err) {
    console.error('[GET /api/hpp/recipes] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const recipeId = await createRecipe(data);
    return NextResponse.json({ success: true, recipeId });
  } catch (err: any) {
    console.error('[POST /api/hpp/recipes] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

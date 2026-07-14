import { NextRequest, NextResponse } from 'next/server';
import { getHppIngredients, createIngredient } from '@/lib/queries/hpp';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get('search') ?? undefined;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = (page - 1) * limit;

  try {
    const result = await getHppIngredients({ search, limit, offset });
    return NextResponse.json({
      data: result.data,
      total: result.total,
      page,
      limit,
    });
  } catch (err) {
    console.error('[GET /api/hpp/ingredients] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const ingredientId = await createIngredient(data);
    return NextResponse.json({ success: true, ingredientId });
  } catch (err: any) {
    console.error('[POST /api/hpp/ingredients] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

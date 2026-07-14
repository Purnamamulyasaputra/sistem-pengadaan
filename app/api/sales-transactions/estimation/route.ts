import { NextRequest, NextResponse } from 'next/server';
import { getSalesIngredientRequirements } from '@/lib/queries/sales-transactions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get('outlet_id');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!outletId || !dateFrom || !dateTo) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const data = await getSalesIngredientRequirements(Number(outletId), dateFrom, dateTo);
    
    // Convert BigInt to Number for JSON serialization
    const serializedData = data.map(item => ({
      ...item,
      ingredient_id: Number(item.ingredient_id),
      item_id: item.item_id ? Number(item.item_id) : null,
      total_raw_qty: Number(item.total_raw_qty)
    }));
    
    return NextResponse.json({ success: true, data: serializedData });
  } catch (error: any) {
    console.error('[GET /api/sales-transactions/estimation] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

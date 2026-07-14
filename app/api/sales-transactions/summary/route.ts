import { NextRequest, NextResponse } from 'next/server';
import { getSalesSummary } from '@/lib/queries/sales-transactions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get('outlet_id');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!outletId || !dateFrom || !dateTo) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const data = await getSalesSummary(Number(outletId), dateFrom, dateTo);
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[GET /api/sales-transactions/summary] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

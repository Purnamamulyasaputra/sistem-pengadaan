import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStockCountHeaders } from '@/lib/queries/opname';

export async function GET(req: NextRequest, { params }: { params: Promise<{ headerId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  
  const { headerId } = await params;
  
  // We reuse the existing list function but filter it via the query in memory if we have to, 
  // or ideally we could have a getStockCountHeaderById, but getStockCountHeaders is fine for now
  // Wait, getStockCountHeaders doesn't accept headerId.
  // Actually, we can fetch all and find, or just create a quick query here.
  const headers = await getStockCountHeaders();
  const header = headers.find(h => h.id === Number(headerId));
  
  if (!header) return NextResponse.json({ success: false, message: 'Not found', data: null }, { status: 404 });
  
  return NextResponse.json({ success: true, message: 'OK', data: header });
}

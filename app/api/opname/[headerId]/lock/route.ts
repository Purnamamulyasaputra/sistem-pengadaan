import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { lockStockCount } from '@/lib/queries/opname';

export async function POST(req: NextRequest, { params }: { params: Promise<{ headerId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  const { headerId } = await params;
  const body = await req.json();
  const result = await lockStockCount(Number(headerId), body.location_type ?? 'PUSAT');
  return NextResponse.json({ success: true, message: 'Opname dikunci. Penyesuaian stok berhasil diaplikasikan.', data: result });
}

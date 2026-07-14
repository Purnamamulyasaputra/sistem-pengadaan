import { NextResponse } from 'next/server';
import { getHppStats } from '@/lib/queries/hpp';

export async function GET() {
  try {
    const stats = await getHppStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error('[GET /api/hpp/stats] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

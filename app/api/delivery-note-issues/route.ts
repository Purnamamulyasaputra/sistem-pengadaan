import { NextRequest, NextResponse } from 'next/server';
import { getDeliveryNoteIssues } from '@/lib/queries/delivery-notes';

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status') || undefined;
    const issues = await getDeliveryNoteIssues(status);
    return NextResponse.json(issues);
  } catch (error: unknown) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}

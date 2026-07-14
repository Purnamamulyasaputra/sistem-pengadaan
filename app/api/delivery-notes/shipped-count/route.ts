import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getShippedDeliveryNoteCount } from '@/lib/queries/delivery-notes';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_OUTLET' || !session.outletId) {
    return NextResponse.json({ success: false, message: 'Forbidden', count: 0 }, { status: 403 });
  }

  try {
    const count = await getShippedDeliveryNoteCount(session.outletId);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('Failed to fetch shipped delivery note count:', error);
    return NextResponse.json({ success: false, message: 'Server error', count: 0 }, { status: 500 });
  }
}

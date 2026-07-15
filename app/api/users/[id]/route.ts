import { NextRequest, NextResponse } from 'next/server';
import { updateUser } from '@/lib/queries/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    const updated = await updateUser(parseInt(id), body);
    
    if (!updated) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: updated, message: 'User successfully updated' });
  } catch (err: any) {
    if (err.code === '23505') {
      return NextResponse.json({ success: false, message: 'Email is already in use' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Failed to update user' }, { status: 500 });
  }
}

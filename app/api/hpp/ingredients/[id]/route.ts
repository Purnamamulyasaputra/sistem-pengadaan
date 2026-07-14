import { NextRequest, NextResponse } from 'next/server';
import { updateIngredient, deleteIngredient } from '@/lib/queries/hpp';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  try {
    const id = parseInt(resolvedParams.id, 10);
    const data = await request.json();
    await updateIngredient(id, data);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[PUT /api/hpp/ingredients/${resolvedParams.id}] Error:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  try {
    const id = parseInt(resolvedParams.id, 10);
    await deleteIngredient(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[DELETE /api/hpp/ingredients/${resolvedParams.id}] Error:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getItemById, updateItem, deleteItem, generateBarcode } from '@/lib/queries/items';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });

  const { id } = await params;
  const item = await getItemById(Number(id));
  if (!item) return NextResponse.json({ success: false, message: 'Item tidak ditemukan', data: null }, { status: 404 });
  return NextResponse.json({ success: true, message: 'OK', data: item });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  if (body.barcode === '') {
    body.barcode = null;
  }

  try {
    const item = await updateItem(Number(id), body);
    if (!item) return NextResponse.json({ success: false, message: 'Item tidak ditemukan', data: null }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Item berhasil diperbarui', data: item });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, message: 'Gagal menyimpan: Barcode sudah digunakan oleh barang lain.', data: null }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Gagal memperbarui: ' + error.message, data: null }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  }

  const { id } = await params;
  try {
    await deleteItem(Number(id));
    return NextResponse.json({ success: true, message: 'Item berhasil dihapus permanen', data: null });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'Gagal menghapus: ' + error.message, data: null }, { status: 400 });
  }
}

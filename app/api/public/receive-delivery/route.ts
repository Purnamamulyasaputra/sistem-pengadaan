import { NextRequest, NextResponse } from 'next/server';
import { getDeliveryNoteByCode, processPublicReceive } from '@/lib/queries/delivery-notes';
import { put } from '@vercel/blob';

// GET: Fetch delivery note info (public, no auth)
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('kode');
  if (!code) {
    return NextResponse.json({ success: false, message: 'Parameter kode tidak boleh kosong.' }, { status: 400 });
  }

  try {
    const dn = await getDeliveryNoteByCode(code);
    if (!dn) {
      return NextResponse.json({ success: false, message: 'Surat Jalan tidak ditemukan.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, dn });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST: Submit delivery receipt
export async function POST(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('kode');
  if (!code) {
    return NextResponse.json({ success: false, message: 'Parameter kode tidak boleh kosong.' }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const photo = formData.get('photo') as File | null;
    const recipient_name = formData.get('recipient_name') as string;
    const itemsJson = formData.get('items') as string;

    if (!photo) {
      return NextResponse.json({ success: false, message: 'Foto bukti penerimaan wajib diunggah.' }, { status: 400 });
    }
    if (!recipient_name || recipient_name.trim() === '') {
      return NextResponse.json({ success: false, message: 'Nama penerima wajib diisi.' }, { status: 400 });
    }
    if (!itemsJson) {
      return NextResponse.json({ success: false, message: 'Data barang tidak valid.' }, { status: 400 });
    }

    let items: { order_item_id: number; qty_received: number; receive_notes: string }[] = [];
    try {
      items = JSON.parse(itemsJson);
    } catch {
      return NextResponse.json({ success: false, message: 'Format data barang salah.' }, { status: 400 });
    }

    // Check delivery note
    const dn = await getDeliveryNoteByCode(code);
    if (!dn) {
      return NextResponse.json({ success: false, message: 'Surat Jalan tidak ditemukan.' }, { status: 404 });
    }
    if (dn.status !== 'DIKIRIM' && dn.status !== 'DRAFT') {
      return NextResponse.json({ success: false, message: `Surat Jalan ini tidak bisa diterima karena statusnya sudah ${dn.status}.` }, { status: 400 });
    }

    // Upload photo to Vercel Blob
    const safeName = photo.name.replace(/[^a-zA-Z0-9.]/g, '') || 'photo.jpg';
    const blob = await put(`proofs/${Date.now()}-${safeName}`, photo, {
      access: 'public',
      contentType: photo.type || 'image/jpeg',
    });

    // Update database
    await processPublicReceive({
      delivery_note_id: dn.id,
      recipient_name: recipient_name.trim(),
      proof_image_url: blob.url,
      items,
    });

    return NextResponse.json({ success: true, message: 'Penerimaan berhasil disimpan.' });
  } catch (error: any) {
    console.error('Error receiving delivery:', error);
    return NextResponse.json({ success: false, message: 'Gagal memproses: ' + error.message }, { status: 500 });
  }
}

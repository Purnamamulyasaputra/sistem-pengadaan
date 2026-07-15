import { NextRequest, NextResponse } from 'next/server';
import { getUsers, createUser } from '@/lib/queries/auth';

export async function GET() {
  try {
    const users = await getUsers();
    return NextResponse.json({ success: true, data: users });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Gagal memuat pengguna' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, role, outlet_id } = body;
    
    if (!name || !email || !role) {
      return NextResponse.json({ success: false, message: 'Semua kolom wajib diisi' }, { status: 400 });
    }

    const newUser = await createUser({
      name,
      email,
      role,
      outlet_id: outlet_id || null,
      // Password is null to enforce Google Login (Option B)
    });

    return NextResponse.json({ success: true, data: newUser, message: 'Pengguna berhasil ditambahkan' });
  } catch (err) {
    const error = err as { code?: string };
    if (error.code === '23505') { // unique violation
      return NextResponse.json({ success: false, message: 'Email sudah terdaftar' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Gagal menambah pengguna' }, { status: 500 });
  }
}

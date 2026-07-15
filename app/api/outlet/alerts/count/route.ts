import { NextResponse } from 'next/server';

export async function GET() {
  // Outlet inventory alerts are not supported in the current physical schema
  // (no outlet_inventory table). We just return 0 to prevent Sidebar from crashing.
  return NextResponse.json({ count: 0 });
}

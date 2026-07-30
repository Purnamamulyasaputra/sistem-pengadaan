import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { getAllActiveMokaTokens } from '@/lib/queries/moka';
import { syncTransactions } from '@/lib/queries/moka_transactions';
import { deductOutletStockFromSales } from '@/lib/queries/outlet-inventory';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session?.role !== 'ADMIN_OUTLET' || !session.outletId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { date } = body; // format YYYY-MM-DD
    if (!date) {
      return NextResponse.json({ success: false, message: 'Date is required' }, { status: 400 });
    }

    const outletId = session.outletId as number;

    // 1. Sync from Moka
    const start = new Date(`${date}T00:00:00+07:00`);
    const sinceEpoch = Math.floor(start.getTime() / 1000);

    const end = new Date(`${date}T23:59:59+07:00`);
    const untilEpoch = Math.floor(end.getTime() / 1000);

    const tokens = await getAllActiveMokaTokens();
    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ success: false, message: 'Moka API tokens not configured' }, { status: 400 });
    }

    // Find the outlet's business_id
    const outletRes = await query('SELECT moka_business_id FROM outlets WHERE id = $1', [outletId]);
    if (outletRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Outlet tidak ditemukan' }, { status: 404 });
    }
    let businessId = outletRes.rows[0].moka_business_id;

    // Auto-fallback: Jika moka_business_id NULL dan tepat ada 1 token Moka aktif di sistem, hubungkan otomatis
    if (!businessId && tokens.length === 1 && tokens[0].business_id) {
      businessId = tokens[0].business_id;
      await query('UPDATE outlets SET moka_business_id = $1 WHERE id = $2', [businessId, outletId]);
    }

    if (!businessId) {
      return NextResponse.json({ success: false, message: 'Outlet belum terhubung dengan Moka Business ID. Silakan hubungkan outlet di menu Pengaturan Moka.' }, { status: 400 });
    }

    // Find the specific token for this business
    const correctToken = tokens.find(t => t.business_id === businessId);
    if (!correctToken) {
      return NextResponse.json({ success: false, message: `Token Moka aktif tidak ditemukan untuk bisnis ID ${businessId}` }, { status: 400 });
    }

    // Sync from Moka using only the correct token
    const syncResult = await syncTransactions(correctToken as any, sinceEpoch, untilEpoch, outletId.toString());
    if (!syncResult.success) {
      throw new Error(syncResult.message || 'Failed to sync transactions from Moka');
    }

    // 2. Deduct from Inventory
    const deductionResult = await deductOutletStockFromSales(outletId, date);

    return NextResponse.json({ 
      success: true, 
      syncStatus: syncResult,
      deduction: deductionResult,
      message: `Berhasil tersinkronisasi. ${deductionResult.count} transaksi baru diproses, memotong ${deductionResult.ingredientsDeducted} bahan dari ${deductionResult.itemsDeducted} jenis menu terjual.`
    });
  } catch (error: unknown) {
    console.error('[POST /api/outlet/sync-sales]', error);
    return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { syncSales } from "@/lib/queries/moka_sales";
import { query } from "@/lib/db";
import { getAllActiveMokaTokens } from "@/lib/queries/moka";
import { syncTransactions } from "@/lib/queries/moka_transactions";
import { deductOutletStockFromSales } from "@/lib/queries/outlet-inventory";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { start_date, end_date, outlet_id } = body;

        if (!start_date || !end_date) {
            return NextResponse.json({ message: "Tanggal Mulai dan Tanggal Akhir harus diisi (YYYY-MM-DD)" }, { status: 400 });
        }

        const tokens = await getAllActiveMokaTokens();
        if (!tokens || tokens.length === 0) {
            return NextResponse.json({ message: "Tidak ada akun Moka yang terhubung." }, { status: 400 });
        }

        // ── LANGKAH 1: Sync moka_item_sales (untuk tampilan cups/revenue di dashboard) ──
        // Hapus data lama untuk periode ini sebelum insert ulang agar tidak ada duplikasi ringkasan
        let deleteQuery = 'DELETE FROM moka_item_sales WHERE period_start = $1 AND period_end = $2';
        let deleteParams: unknown[] = [start_date, end_date];
        if (outlet_id) {
            deleteQuery += ' AND outlet_id = $3';
            deleteParams.push(outlet_id);
        }
        await query(deleteQuery, deleteParams);

        const salesResults = await Promise.allSettled(
            tokens.map((token: any) => syncSales(token, start_date, end_date, outlet_id))
        );

        let salesSynced = 0;
        salesResults.forEach(r => {
            if (r.status === 'fulfilled' && r.value.success) {
                salesSynced++;
            }
        });

        // ── LANGKAH 2: Sync moka_transactions (data transaksi individual, idempotent via ON CONFLICT) ──
        // Ini diperlukan agar deductOutletStockFromSales punya data yang bisa diproses.
        // ON CONFLICT (id) DO UPDATE → aman dipanggil berkali-kali oleh Pusat maupun Outlet.
        const startEpoch = Math.floor(new Date(`${start_date}T00:00:00+07:00`).getTime() / 1000);
        const endEpoch = Math.floor(new Date(`${end_date}T23:59:59+07:00`).getTime() / 1000);

        const trxResults = await Promise.allSettled(
            tokens.map((token: any) =>
                syncTransactions(token, startEpoch, endEpoch, outlet_id?.toString())
            )
        );

        let trxSynced = 0;
        trxResults.forEach(r => {
            if (r.status === 'fulfilled' && (r.value as any).success) trxSynced++;
        });

        // ── LANGKAH 3: Deduct stok outlet dari transaksi yang belum diproses ──
        // deductOutletStockFromSales hanya memproses transaksi WHERE is_stock_deducted = FALSE,
        // lalu menandai is_stock_deducted = TRUE. Ini menjamin idempotency penuh:
        // → Jika Outlet sudah klik "Sync Penjualan" lebih dulu, semua transaksi sudah TRUE → Pusat tidak double.
        // → Jika Pusat klik lebih dulu, transaksi di-set TRUE → Outlet sync tidak double.
        // → Jika keduanya klik bersamaan, DB transaction lock memastikan hanya satu yang proses.
        if (salesSynced > 0 || trxSynced > 0) {
            const outletQuery = outlet_id
                ? await query('SELECT id FROM outlets WHERE id = $1', [outlet_id])
                : await query("SELECT id FROM outlets WHERE type = 'STORE' AND is_active = TRUE");

            // Jalankan deduct per tanggal dalam rentang start_date..end_date
            const dates: string[] = [];
            const cur = new Date(start_date);
            const endD = new Date(end_date);
            while (cur <= endD) {
                dates.push(cur.toISOString().slice(0, 10));
                cur.setDate(cur.getDate() + 1);
            }

            const deductResults = await Promise.allSettled(
                outletQuery.rows.flatMap((o: any) =>
                    dates.map(d => deductOutletStockFromSales(Number(o.id), d))
                )
            );

            const deductedCount = deductResults.filter(r => r.status === 'fulfilled').length;

            return NextResponse.json({
                success: true,
                message: `Sinkronisasi selesai!`,
                sales_synced: salesSynced,
                trx_synced: trxSynced,
                deduct_count: deductedCount,
            });
        } else {
            return NextResponse.json({ message: 'Gagal sinkronisasi dari semua akun yang terhubung.' }, { status: 500 });
        }

    } catch (error: unknown) {
        console.error("Sync sales API error:", error);
        return NextResponse.json(
            { message: (error instanceof Error ? error.message : 'Unknown error') || "Internal server error" },
            { status: 500 }
        );
    }
}

import { NextResponse } from "next/server";
import { syncSales } from "@/lib/queries/moka_sales";
import { query } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { start_date, end_date, outlet_id } = body;

        if (!start_date || !end_date) {
            return NextResponse.json({ message: "start_date and end_date are required (YYYY-MM-DD)" }, { status: 400 });
        }

        // Before inserting new data for the same period, we should probably delete the old data
        // for this exact period and outlet to prevent duplicates, or we can just delete it in the syncSales logic.
        // Let's delete it here to be safe.
        let deleteQuery = 'DELETE FROM moka_item_sales WHERE period_start = $1 AND period_end = $2';
        let deleteParams: any[] = [start_date, end_date];
        if (outlet_id) {
            deleteQuery += ' AND outlet_id = $3';
            deleteParams.push(outlet_id);
        }
        await query(deleteQuery, deleteParams);

        const result = await syncSales(start_date, end_date, outlet_id);

        if (!result.success) {
            return NextResponse.json({ message: result.message }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            message: `Berhasil menarik ${result.count} data penjualan.`,
            count: result.count
        });

    } catch (error: any) {
        console.error("Sync sales API error:", error);
        return NextResponse.json(
            { message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

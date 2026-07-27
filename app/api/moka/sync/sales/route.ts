import { NextResponse } from "next/server";
import { syncSales } from "@/lib/queries/moka_sales";
import { query } from "@/lib/db";
import { getAllActiveMokaTokens } from "@/lib/queries/moka";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { start_date, end_date, outlet_id } = body;

        if (!start_date || !end_date) {
            return NextResponse.json({ message: "start_date and end_date are required (YYYY-MM-DD)" }, { status: 400 });
        }

        const tokens = await getAllActiveMokaTokens();
        if (!tokens || tokens.length === 0) {
            return NextResponse.json({ message: "No active Moka accounts connected." }, { status: 400 });
        }

        // Before inserting new data for the same period, we should probably delete the old data
        // for this exact period and outlet to prevent duplicates
        let deleteQuery = 'DELETE FROM moka_item_sales WHERE period_start = $1 AND period_end = $2';
        let deleteParams: unknown[] = [start_date, end_date];
        if (outlet_id) {
            deleteQuery += ' AND outlet_id = $3';
            deleteParams.push(outlet_id);
        } else {
            // Note: If no outlet_id is provided, it deletes for all outlets across all accounts for that period.
            // This is acceptable behavior for a full date-range sync.
        }
        await query(deleteQuery, deleteParams);

        let totalCount = 0;
        const results = await Promise.allSettled(
            tokens.map((token: any) => syncSales(token, start_date, end_date, outlet_id))
        );

        let successful = 0;
        results.forEach(r => {
            if (r.status === 'fulfilled' && r.value.success) {
                successful++;
                if (r.value.count) totalCount += r.value.count;
            }
        });

        const totalAccounts = tokens.length;

        if (successful > 0) {
            return NextResponse.json({ 
                success: true, 
                message: `Successfully synced ${totalCount} sales data across ${successful}/${totalAccounts} accounts.`,
                count: totalCount
            });
        } else {
            return NextResponse.json({ message: 'Failed to sync sales for all connected accounts.' }, { status: 500 });
        }

    } catch (error: unknown) {
        console.error("Sync sales API error:", error);
        return NextResponse.json(
            { message: (error instanceof Error ? error.message : 'Unknown error') || "Internal server error" },
            { status: 500 }
        );
    }
}

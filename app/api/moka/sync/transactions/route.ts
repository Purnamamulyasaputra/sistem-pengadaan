import { NextResponse } from "next/server";
import { syncTransactions } from "@/lib/queries/moka_transactions";
import { getAllActiveMokaTokens } from "@/lib/queries/moka";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { start_date, end_date, outlet_id } = body;

        if (!start_date || !end_date) {
            return NextResponse.json({ message: "start_date and end_date are required (YYYY-MM-DD)" }, { status: 400 });
        }

        // Convert start_date to epoch (WIB) 00:00:00
        const start = new Date(`${start_date}T00:00:00+07:00`);
        const sinceEpoch = Math.floor(start.getTime() / 1000);

        // Convert end_date to epoch (WIB) 23:59:59
        const end = new Date(`${end_date}T23:59:59+07:00`);
        const untilEpoch = Math.floor(end.getTime() / 1000);

        const tokens = await getAllActiveMokaTokens();
        if (!tokens || tokens.length === 0) {
            return NextResponse.json({ message: "No active Moka accounts connected." }, { status: 400 });
        }

        let totalCount = 0;
        let totalItemsCount = 0;

        const results = await Promise.allSettled(
            tokens.map(token => syncTransactions(token, sinceEpoch, untilEpoch, outlet_id))
        );

        let successful = 0;
        results.forEach(r => {
            if (r.status === 'fulfilled' && r.value.success) {
                successful++;
                if (r.value.count) totalCount += r.value.count;
                if (r.value.itemsCount) totalItemsCount += r.value.itemsCount;
            }
        });

        const totalAccounts = tokens.length;

        if (successful > 0) {
            return NextResponse.json({ 
                success: true, 
                message: `Successfully synced ${totalCount} transactions (${totalItemsCount} items) across ${successful}/${totalAccounts} accounts.`,
                count: totalCount
            });
        } else {
            return NextResponse.json({ message: 'Failed to sync transactions for all connected accounts.' }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Sync transactions API error:", error);
        return NextResponse.json(
            { message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

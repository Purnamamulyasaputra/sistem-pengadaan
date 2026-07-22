import { NextResponse } from "next/server";
import { syncCustomers } from "@/lib/queries/moka_customers";
import { query } from "@/lib/db";
import { getAllActiveMokaTokens } from "@/lib/queries/moka";

export async function POST(req: Request) {
    try {
        const tokens = await getAllActiveMokaTokens();
        if (!tokens || tokens.length === 0) {
            return NextResponse.json({ message: "No active Moka accounts connected." }, { status: 400 });
        }

        let totalCount = 0;
        const results = await Promise.allSettled(
            tokens.map(token => syncCustomers(token, String(token.business_id)))
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
                message: `Successfully synced ${totalCount} customers across ${successful}/${totalAccounts} accounts.`,
                count: totalCount
            });
        } else {
            return NextResponse.json({ message: 'Failed to sync customers for all connected accounts.' }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Sync customers API error:", error);
        return NextResponse.json(
            { message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

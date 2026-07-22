import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;

        const res = await query(`
            SELECT * FROM moka_transaction_items
            WHERE transaction_id = $1
            ORDER BY uuid ASC
        `, [id]);

        return NextResponse.json({
            data: res.rows
        });

    } catch (error: any) {
        console.error("Error fetching transaction items:", error);
        return NextResponse.json(
            { message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

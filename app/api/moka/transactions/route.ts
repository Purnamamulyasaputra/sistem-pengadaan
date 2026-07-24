import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const outlet_id = searchParams.get("outlet_id");
        const start_date = searchParams.get("start_date");
        const end_date = searchParams.get("end_date");
        const search = searchParams.get("search");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const offset = (page - 1) * limit;

        let queryStr = `
            SELECT t.*, o.name as outlet_name 
            FROM moka_transactions t
            LEFT JOIN outlets o ON t.outlet_id = o.id
            WHERE 1=1
        `;
        let summaryQueryStr = `
            SELECT 
                COALESCE(SUM(t.total_collected), 0) AS total_revenue,
                COUNT(t.id) AS total_count,
                COALESCE(SUM(CASE WHEN t.is_refunded = true THEN 1 ELSE 0 END), 0) AS total_refunded,
                COALESCE(SUM(CASE WHEN LOWER(t.payment_type) LIKE '%cash%' OR LOWER(t.payment_type_label) LIKE '%cash%' THEN 1 ELSE 0 END), 0) AS cash_count
            FROM moka_transactions t
            LEFT JOIN outlets o ON t.outlet_id = o.id
            WHERE 1=1
        `;
        
        const params: any[] = [];
        let paramCount = 1;

        if (outlet_id) {
            queryStr += ` AND t.outlet_id = $${paramCount}`;
            summaryQueryStr += ` AND t.outlet_id = $${paramCount}`;
            params.push(outlet_id);
            paramCount++;
        }

        if (start_date && end_date) {
            queryStr += ` AND t.created_at >= $${paramCount} AND t.created_at < ($${paramCount + 1}::date + interval '1 day')`;
            summaryQueryStr += ` AND t.created_at >= $${paramCount} AND t.created_at < ($${paramCount + 1}::date + interval '1 day')`;
            params.push(start_date);
            params.push(end_date);
            paramCount += 2;
        }

        if (search) {
            queryStr += ` AND (t.payment_no ILIKE $${paramCount} OR t.collected_by ILIKE $${paramCount})`;
            summaryQueryStr += ` AND (t.payment_no ILIKE $${paramCount} OR t.collected_by ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        queryStr += ` ORDER BY t.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        const queryParams = [...params, limit, offset];

        const [dataRes, summaryRes] = await Promise.all([
            query(queryStr, queryParams),
            query(summaryQueryStr, params)
        ]);

        const summary = summaryRes.rows[0] || {};

        return NextResponse.json({
            data: dataRes.rows,
            total: parseInt(summary.total_count || '0'),
            summary: {
                totalRevenue: parseFloat(summary.total_revenue || '0'),
                totalCount: parseInt(summary.total_count || '0'),
                totalRefunded: parseInt(summary.total_refunded || '0'),
                cashCount: parseInt(summary.cash_count || '0')
            },
            page,
            limit
        });

    } catch (error: any) {
        console.error("Error fetching transactions:", error);
        return NextResponse.json(
            { message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

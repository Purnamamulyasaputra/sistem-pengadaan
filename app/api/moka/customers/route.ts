import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const sort = searchParams.get('sort') || 'newest';
        const hasEmail = searchParams.get('hasEmail') || 'all';
        const outletId = searchParams.get('outlet_id') || '';
        
        const offset = (page - 1) * limit;

        let queryStr = `
            SELECT 
                id, name, email, phone, address, city, state, postal_code, sex, birthday, moka_created_at
            FROM moka_customers
            WHERE is_deleted = false
        `;

        let countQueryStr = `
            SELECT COUNT(*) as total
            FROM moka_customers
            WHERE is_deleted = false
        `;

        const params: any[] = [];
        let paramCount = 1;

        if (outletId) {
            queryStr += ` AND outlet_id = $${paramCount}`;
            countQueryStr += ` AND outlet_id = $${paramCount}`;
            params.push(outletId);
            paramCount++;
        }

        if (search) {
            queryStr += ` AND (name ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
            countQueryStr += ` AND (name ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        if (hasEmail === 'with') {
            queryStr += ` AND email IS NOT NULL AND email != ''`;
            countQueryStr += ` AND email IS NOT NULL AND email != ''`;
        } else if (hasEmail === 'without') {
            queryStr += ` AND (email IS NULL OR email = '')`;
            countQueryStr += ` AND (email IS NULL OR email = '')`;
        }

        let orderBy = 'moka_created_at DESC NULLS LAST';
        if (sort === 'oldest') orderBy = 'moka_created_at ASC NULLS LAST';
        if (sort === 'name_asc') orderBy = 'name ASC NULLS LAST';
        if (sort === 'name_desc') orderBy = 'name DESC NULLS LAST';

        queryStr += ` ORDER BY ${orderBy} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        const queryParams = [...params, limit, offset];

        const [dataRes, countRes] = await Promise.all([
            query(queryStr, queryParams),
            query(countQueryStr, params)
        ]);

        return NextResponse.json({
            success: true,
            data: dataRes.rows,
            total: parseInt(countRes.rows[0].total),
            page,
            limit
        });

    } catch (error: any) {
        console.error("Error fetching customers:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { moka_variant_id, internal_recipe_id } = body;

        if (!moka_variant_id) {
            return NextResponse.json({ message: "moka_variant_id is required" }, { status: 400 });
        }

        // internal_recipe_id can be null to remove the mapping
        
        await query(`
            UPDATE moka_item_variants 
            SET internal_recipe_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [internal_recipe_id, moka_variant_id]);

        return NextResponse.json({ 
            success: true, 
            message: "Item mapping saved successfully." 
        });

    } catch (error: any) {
        console.error("Error mapping Moka item:", error);
        return NextResponse.json(
            { message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

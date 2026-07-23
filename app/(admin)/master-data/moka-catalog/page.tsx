import { query } from "@/lib/db";
import { Link2, Link2Off, RefreshCw, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import MokaSyncCatalogButton from "@/components/moka/MokaSyncCatalogButton";
import MokaCatalogTableClient from "@/components/moka/MokaCatalogTableClient";

export const metadata = {
    title: 'Moka POS Catalog - Sunrise Daily',
};

async function getMokaCatalog(outletId?: string, search?: string, status?: string) {
    let sql = `
        SELECT 
            i.id as item_id,
            i.name as item_name,
            i.category_name,
            i.internal_recipe_id,
            v.id as variant_id,
            v.name as variant_name,
            v.price,
            v.cogs,
            v.sku,
            v.in_stock,
            (SELECT name FROM recipes r WHERE r.id = i.internal_recipe_id) as mapped_recipe_name,
            o.name as outlet_name
        FROM moka_items i
        LEFT JOIN moka_item_variants v ON i.id = v.item_id
        LEFT JOIN moka_outlets o ON i.outlet_id = o.id
        WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (outletId) {
        sql += ` AND i.outlet_id = $${paramCount}`;
        params.push(outletId);
        paramCount++;
    }

    if (search) {
        sql += ` AND i.name ILIKE $${paramCount}`;
        params.push(`%${search}%`);
        paramCount++;
    }

    if (status === 'mapped') {
        sql += ` AND i.internal_recipe_id IS NOT NULL`;
    } else if (status === 'unmapped') {
        sql += ` AND i.internal_recipe_id IS NULL`;
    }

    sql += ` ORDER BY i.category_name, i.name, v.name`;

    const res = await query(sql, params);
    return res.rows;
}

async function getOutletsWithBusiness() {
    const res = await query(`
        SELECT o.id, o.name as outlet_name, t.account_name as business_name
        FROM moka_outlets o
        LEFT JOIN moka_tokens t ON o.business_id = t.business_id
        ORDER BY t.account_name, o.name
    `);
    
    // Group outlets by business
    const grouped: Record<string, any[]> = {};
    for (const row of res.rows) {
        const bName = row.business_name || 'Unknown Business';
        if (!grouped[bName]) grouped[bName] = [];
        grouped[bName].push({ id: row.id, name: row.outlet_name });
    }
    return grouped;
}

export default async function MokaCatalogPage(props: { searchParams: Promise<{ page?: string, outlet_id?: string, search?: string, status?: string }> }) {
    const searchParams = await props.searchParams;
    const page = parseInt(searchParams?.page || '1', 10);
    const outletId = searchParams?.outlet_id || '';
    const search = searchParams?.search || '';
    const status = searchParams?.status || 'all';
    
    const catalog = await getMokaCatalog(outletId, search, status);
    const outletsGrouped = await getOutletsWithBusiness();

    // Fetch active recipes for mapping dropdown
    const recipesRes = await query(`
        SELECT id, name
        FROM recipes 
        ORDER BY name ASC
    `);
    const allRecipes = recipesRes.rows;

    // Group by item
    const groupedCatalog: Record<string, any> = {};
    for (const row of catalog) {
        if (!groupedCatalog[row.item_id]) {
            groupedCatalog[row.item_id] = {
                id: row.item_id,
                name: row.item_name,
                category: row.category_name,
                internal_recipe_id: row.internal_recipe_id,
                mapped_recipe_name: row.mapped_recipe_name,
                outlet_name: row.outlet_name,
                variants: []
            };
        }
        if (row.variant_id) {
            groupedCatalog[row.item_id].variants.push({
                id: row.variant_id,
                name: row.variant_name,
                price: row.price,
                cogs: row.cogs,
                sku: row.sku,
                in_stock: row.in_stock
            });
        }
    }

    const allItems = Object.values(groupedCatalog);
    const totalItems = allItems.length;
    const ITEMS_PER_PAGE = 20;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const safePage = Math.max(1, Math.min(page, totalPages));

    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    const items = allItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const buildQueryString = (pageOverride?: number) => {
        const params = new URLSearchParams();
        if (pageOverride && pageOverride > 1) params.set('page', pageOverride.toString());
        if (outletId) params.set('outlet_id', outletId);
        if (search) params.set('search', search);
        if (status && status !== 'all') params.set('status', status);
        const qs = params.toString();
        return qs ? `?${qs}` : '';
    };

    return (
        <section className="page-content">
            <div className="flex justify-between items-center mb-2.5">
                <div>
                    <h1 className="text-[18px] font-bold text-gray-900 font-['Cabin']">Moka POS Catalog</h1>
                    <p className="text-[12px] text-gray-500 mt-0.5">Sync product master and pricing from Moka POS</p>
                </div>
                <div className="flex gap-3">
                    <MokaSyncCatalogButton />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <MokaCatalogTableClient 
                    items={items} 
                    recipes={allRecipes} 
                    outletsGrouped={outletsGrouped} 
                    activeOutletId={outletId}
                    activeSearch={search}
                    activeStatus={status} 
                />
                
                {items.length === 0 && (
                    <div className="px-6 py-12 text-center text-gray-500 border-t border-gray-100">
                        <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                        <p>No data available for the selected filters.</p>
                        <p className="text-xs mt-1">Please try changing the filters or click Sync Now.</p>
                    </div>
                )}
                
                {totalPages > 1 && (
                    <div className="pagination border-t border-gray-200">
                        <div className="info">
                            Showing <span className="font-medium text-gray-900">{(safePage - 1) * ITEMS_PER_PAGE + (items.length > 0 ? 1 : 0)}</span> to <span className="font-medium text-gray-900">{Math.min(safePage * ITEMS_PER_PAGE, allItems.length)}</span> of <span className="font-medium text-gray-900">{allItems.length}</span> items
                        </div>
                        <div className="page-btns">
                            <Link
                                href={`/master-data/moka-catalog${buildQueryString(safePage > 1 ? safePage - 1 : 1)}`}
                                className={`page-btn flex items-center justify-center ${safePage === 1 ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </Link>
                            
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = safePage;
                                if (totalPages <= 5) pageNum = i + 1;
                                else if (safePage <= 3) pageNum = i + 1;
                                else if (safePage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = safePage - 2 + i;
                                
                                if (pageNum < 1 || pageNum > totalPages) return null;
                                
                                return (
                                    <Link
                                        key={pageNum}
                                        href={`/master-data/moka-catalog${buildQueryString(pageNum)}`}
                                        className={`page-btn flex items-center justify-center ${safePage === pageNum ? 'active' : ''}`}
                                    >
                                        {pageNum}
                                    </Link>
                                );
                            })}

                            <Link
                                href={`/master-data/moka-catalog${buildQueryString(safePage < totalPages ? safePage + 1 : totalPages)}`}
                                className={`page-btn flex items-center justify-center ${safePage === totalPages ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

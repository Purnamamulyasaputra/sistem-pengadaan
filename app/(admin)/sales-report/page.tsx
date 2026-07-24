import { query } from '@/lib/db';
import SalesReportClient from '@/components/moka/SalesReportClient';
import { getSyncStatus } from '@/lib/queries/moka_sync';

export default async function SalesReportPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const resolvedSearchParams = await searchParams;
    // Determine filters
    const outletId = typeof resolvedSearchParams.outletId === 'string' ? resolvedSearchParams.outletId : '';
    let startDate = typeof resolvedSearchParams.startDate === 'string' ? resolvedSearchParams.startDate : '';
    let endDate = typeof resolvedSearchParams.endDate === 'string' ? resolvedSearchParams.endDate : '';

    if (!startDate || !endDate) {
        const d = new Date();
        endDate = d.toISOString().split('T')[0];
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString().split('T')[0];
    }

    // Fetch available outlets
    const outletsRes = await query('SELECT id, name FROM outlets ORDER BY name ASC');
    const outlets = outletsRes.rows.map(r => ({ id: String(r.id), name: String(r.name) }));

    const syncStatus = await getSyncStatus();

    // Fetch sales data based on filters
    let salesQuery = `
        SELECT name, sku, category_name, SUM(item_sold) as item_sold, 
               SUM(gross_sales) as gross_sales, SUM(net_sales) as net_sales, 
               SUM(discount) as discount, SUM(refund) as refund, SUM(cogs) as cogs
        FROM moka_item_sales
        WHERE period_start >= $1 AND period_end <= $2
    `;
    let salesParams: any[] = [startDate, endDate];
    
    if (outletId) {
        salesQuery += ` AND outlet_id = $3`;
        salesParams.push(outletId);
    }
    
    salesQuery += ` GROUP BY name, sku, category_name ORDER BY net_sales DESC`;
    
    const salesRes = await query(salesQuery, salesParams);
    const salesData = salesRes.rows.map(row => ({
        name: String(row.name || ''),
        sku: row.sku ? String(row.sku) : null,
        category_name: String(row.category_name || ''),
        item_sold: Number(row.item_sold) || 0,
        gross_sales: Number(row.gross_sales) || 0,
        net_sales: Number(row.net_sales) || 0,
        discount: Number(row.discount) || 0,
        refund: Number(row.refund) || 0,
        cogs: Number(row.cogs) || 0,
    }));

    return (
        <section className="screen">
            <SalesReportClient 
                outlets={outlets} 
                lastSync={syncStatus.sales} 
                initialSalesData={salesData} 
                initialStartDate={startDate}
                initialEndDate={endDate}
                initialOutletId={outletId}
            />
        </section>
    );
}

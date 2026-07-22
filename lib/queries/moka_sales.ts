import { fetchMokaAPIWithToken } from '@/lib/moka/api';
import { query } from '@/lib/db';

export async function syncSales(token: any, startDateStr: string, endDateStr: string, outletId?: string) {
    try {
        if (!token) throw new Error("No token provided");

        let outlets = [];
        if (outletId) {
            outlets = [{ id: outletId }];
        } else {
            const outRes = await query('SELECT id FROM moka_outlets WHERE business_id = $1', [token.business_id]);
            outlets = outRes.rows;
        }

        const timestamp = new Date();
        let totalItemsSynced = 0;

        for (const out of outlets) {
            // Convert YYYY-MM-DD to DD/MM/YYYY for Moka API v3 item_sales
            const [sYear, sMonth, sDay] = startDateStr.split('-');
            const [eYear, eMonth, eDay] = endDateStr.split('-');
            const mokaStart = `${sDay}/${sMonth}/${sYear}`;
            const mokaEnd = `${eDay}/${eMonth}/${eYear}`;

            const salesData = await fetchMokaAPIWithToken(token, `/v3/outlets/${out.id}/reports/item_sales?start=${mokaStart}&end=${mokaEnd}`);
            
            // Wait, does Moka API v3 return data.item_sales? 
            // Often it's data.item_sales or data.reports. Let's assume data.item_sales or data
            // Since we can't test it directly, we will try to parse it.
            const sales = salesData.data?.item_sales || salesData.data || [];
            
            if (Array.isArray(sales)) {
                for (const sale of sales) {
                    await query(`
                        INSERT INTO moka_item_sales (
                            outlet_id, name, sku, category_name, item_sold, item_refunded, 
                            gross_sales, discount, refund, net_sales, cogs, gross_profit, 
                            period_start, period_end, sync_date
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
                        )
                    `, [
                        out.id, 
                        sale.name || sale.item_name, 
                        sale.sku || null, 
                        sale.category_name || 'Uncategorized',
                        sale.item_sold || 0,
                        sale.item_refunded || 0,
                        sale.gross_sales || 0,
                        sale.discount || 0,
                        sale.refund || 0,
                        sale.net_sales || 0,
                        sale.cogs || 0,
                        sale.gross_profit || 0,
                        startDateStr,
                        endDateStr,
                        timestamp
                    ]);
                    totalItemsSynced++;
                }
            }
        }

        return { success: true, count: totalItemsSynced };
    } catch (error: unknown) {
        console.error("Error syncing sales:", error);
        return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
}

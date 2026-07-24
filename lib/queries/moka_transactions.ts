import { query } from "@/lib/db";
import { fetchMokaAPIWithToken } from "@/lib/moka/api";

export async function syncTransactions(token: any, sinceEpoch: number, untilEpoch: number, outletId?: string) {
    try {
        if (!token) throw new Error("No token provided");

        let outlets: { id: string | number }[] = [];
        if (outletId) {
            const outRes = await query('SELECT id FROM outlets WHERE id = $1', [outletId]);
            outlets = outRes.rows as { id: string | number }[];
        } else {
            const outRes = await query('SELECT id FROM outlets WHERE moka_business_id = $1', [token.business_id]);
            outlets = outRes.rows as { id: string | number }[];
        }

        let totalTrxSynced = 0;
        let totalItemsSynced = 0;
        const timestamp = new Date();

        for (const out of outlets) {
            // PRD Section 8.5: Endpoint for transaction details with Unix epoch params
            let currentUrl: string | null = `/v4/outlets/${out.id}/reports/get_latest_transactions?per_page=50&since=${sinceEpoch}&until=${untilEpoch}&time_filter=created_at&include_promo=true&reorder_type=DESC`;

            while (currentUrl) {
                const resp = await fetchMokaAPIWithToken(token, currentUrl);
                // PRD Section 8.5: Moka response shape: { data: { payments: [...], completed: bool, next_url: string|null }, meta: {...} }
                const innerData = resp.data || {};
                const payments: any[] = innerData.payments || [];

                for (const payment of payments) {
                    // Upsert transaction header
                    await query(`
                        INSERT INTO moka_transactions (
                            id, outlet_id, payment_no, payment_type, payment_type_label, 
                            total_collected, subtotal, discounts, gratuities, taxes, 
                            tendered, change_amount, transaction_date, transaction_time, 
                            collected_by, served_by, order_id, outlet_name, is_refunded, 
                            total_refund, guid, created_at, updated_at, synced_at
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
                            $16, $17, $18, $19, $20, $21, $22, $23, $24
                        )
                        ON CONFLICT (id) DO UPDATE SET
                            payment_no = EXCLUDED.payment_no,
                            total_collected = EXCLUDED.total_collected,
                            is_refunded = EXCLUDED.is_refunded,
                            total_refund = EXCLUDED.total_refund,
                            updated_at = EXCLUDED.updated_at,
                            synced_at = EXCLUDED.synced_at
                    `, [
                        payment.id,
                        out.id,
                        payment.payment_no,
                        payment.payment_type,
                        payment.payment_type_label,
                        payment.total_collected || 0,
                        payment.subtotal || 0,
                        payment.discounts || 0,
                        payment.gratuities || 0,
                        payment.taxes || 0,
                        payment.tendered || 0,
                        payment.change || 0,         // PRD field: payment.change
                        payment.transaction_date,
                        payment.transaction_time,
                        payment.collected_by,
                        payment.served_by,
                        payment.order_id,
                        payment.outlet_name,
                        payment.is_refunded || false,
                        payment.total_refund || 0,
                        payment.guid,
                        payment.created_at,          // PRD: data.payments[].created_at (TIMESTAMPTZ)
                        payment.updated_at,
                        timestamp
                    ]);
                    totalTrxSynced++;

                    // Upsert checkout items (PRD Section 8.5.2)
                    if (payment.checkouts && payment.checkouts.length > 0) {
                        for (const item of payment.checkouts) {
                            await query(`
                                INSERT INTO moka_transaction_items (
                                    uuid, transaction_id, item_id, item_name, item_variant_id, 
                                    item_variant_name, category_name, sales_type_name, 
                                    quantity, price, gross_sales, net_sales, cogs, sku, 
                                    is_recipe, refunded_quantity
                                ) VALUES (
                                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
                                )
                                ON CONFLICT (uuid) DO UPDATE SET
                                    quantity = EXCLUDED.quantity,
                                    gross_sales = EXCLUDED.gross_sales,
                                    net_sales = EXCLUDED.net_sales
                            `, [
                                item.uuid,           // PRD: checkouts[].uuid (primary key)
                                payment.id,
                                item.item_id,
                                item.item_name,
                                item.item_variant_id,
                                item.item_variant_name,
                                item.category_name,
                                item.sales_type_name,
                                item.quantity || 1,
                                item.price || 0,
                                item.gross_sales || 0,
                                item.net_sales || 0,
                                item.cogs || 0,
                                item.sku || '',
                                item.is_recipe || false,
                                item.refunded_quantity || 0
                            ]);
                            totalItemsSynced++;
                        }
                    }
                }

                // PRD Section 9.2: continue pagination if completed === false and next_url exists
                if (innerData.completed === false && innerData.next_url) {
                    currentUrl = innerData.next_url; // full absolute URL from Moka
                } else {
                    currentUrl = null;
                }
            }
        }

        return { success: true, count: totalTrxSynced, itemsCount: totalItemsSynced };
    } catch (error: unknown) {
        console.error("Error syncing transactions:", error);
        return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
}

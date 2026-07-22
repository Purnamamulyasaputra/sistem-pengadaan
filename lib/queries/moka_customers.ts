import { query } from "@/lib/db";
import { fetchMokaAPIWithToken } from "@/lib/moka/api";

export async function syncCustomers(token: any, businessId: string) {
    try {
        if (!token) throw new Error("No token provided");
        let totalCustSynced = 0;
        const timestamp = new Date();

        let currentUrl: string | null = `/v1/businesses/${businessId}/customers`;

        while (currentUrl) {
            const data = await fetchMokaAPIWithToken(token, currentUrl);
            const customers = data.data?.customers || [];

            for (const cust of customers) {
                // Upsert Customer
                await query(`
                    INSERT INTO moka_customers (
                        id, business_id, outlet_id, name, email, phone, 
                        address, city, state, postal_code, birthday, 
                        sex, guid, uniq_id, is_deleted, moka_created_at, 
                        moka_updated_at, synchronized_at, synced_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 
                        $12, $13, $14, $15, $16, $17, $18, $19
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        phone = EXCLUDED.phone,
                        address = EXCLUDED.address,
                        city = EXCLUDED.city,
                        state = EXCLUDED.state,
                        postal_code = EXCLUDED.postal_code,
                        birthday = EXCLUDED.birthday,
                        sex = EXCLUDED.sex,
                        is_deleted = EXCLUDED.is_deleted,
                        moka_updated_at = EXCLUDED.moka_updated_at,
                        synchronized_at = EXCLUDED.synchronized_at,
                        synced_at = EXCLUDED.synced_at
                `, [
                    cust.id,
                    cust.business_id,
                    cust.outlet_id || null,
                    cust.name,
                    cust.email,
                    cust.phone,
                    cust.address,
                    cust.city,
                    cust.state,
                    cust.postal_code,
                    cust.birthday,
                    cust.sex,
                    cust.guid,
                    cust.uniq_id,
                    cust.is_deleted || false,
                    cust.created_at,
                    cust.updated_at,
                    cust.synchronized_at,
                    timestamp
                ]);
                totalCustSynced++;
            }

            if (data.data?.completed === false && data.data?.next_url) {
                currentUrl = data.data.next_url;
            } else {
                currentUrl = null; // Finished
            }
        }

        return { success: true, count: totalCustSynced };
    } catch (error: unknown) {
        console.error("Error syncing customers:", error);
        return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
}

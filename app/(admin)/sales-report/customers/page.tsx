import { Suspense } from 'react';
import CustomerTableClient from '@/components/moka/CustomerTableClient';
import { query } from '@/lib/db';

export const metadata = {
    title: 'Data Pelanggan Moka | Sunrise Daily',
};

async function getOutletsWithBusiness() {
    const res = await query(`
        SELECT o.id, o.name as outlet_name, 'Sunrise Daily' as business_name
        FROM outlets o
        ORDER BY o.name
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

export default async function CustomersPage(props: { searchParams: Promise<{ outlet_id?: string }> }) {
    const searchParams = await props.searchParams;
    const outletId = searchParams?.outlet_id || '';
    const outletsGrouped = await getOutletsWithBusiness();

    return (
        <section className="screen">
            <Suspense fallback={<div className="h-64 flex items-center justify-center">Memuat data...</div>}>
                <CustomerTableClient outletsGrouped={outletsGrouped} activeOutletId={outletId} />
            </Suspense>
        </section>
    );
}

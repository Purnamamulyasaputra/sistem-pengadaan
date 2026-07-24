import { Suspense } from 'react';
import { query } from '@/lib/db';
import TransactionTableClient from '@/components/moka/TransactionTableClient';

export const metadata = {
    title: 'Data Transaksi Moka | Sunrise Daily',
};

async function getOutlets(): Promise<{ id: string; name: string }[]> {
    try {
        const res = await query('SELECT id, name FROM outlets ORDER BY name ASC');
        return res.rows.map((row) => ({
            id: String(row.id),
            name: String(row.name)
        }));
    } catch (e) {
        return [];
    }
}

export default async function TransactionsPage() {
    const outlets = await getOutlets();

    return (
        <section className="screen">


            <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading...</div>}>
                <TransactionTableClient outlets={outlets} />
            </Suspense>
        </section>
    );
}

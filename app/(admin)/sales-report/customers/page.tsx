import { Suspense } from 'react';
import CustomerTableClient from '@/components/moka/CustomerTableClient';

export const metadata = {
    title: 'Data Pelanggan Moka | Sunrise Daily',
};

export default function CustomersPage() {
    return (
        <section className="screen">
            <Suspense fallback={<div className="h-64 flex items-center justify-center">Memuat data...</div>}>
                <CustomerTableClient />
            </Suspense>
        </section>
    );
}

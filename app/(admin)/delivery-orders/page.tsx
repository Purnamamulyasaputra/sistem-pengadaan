'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface DeliveryNote {
  id: number;
  delivery_note_number: string;
  outlet_name: string;
  delivery_date: string;
  status: string;
}

export default function DeliveryOrdersPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/delivery-notes');
    const data = await res.json();
    setNotes(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  return (
    <section className="screen">
      <div className="card">

        <div className="card-head">
          <div>
            <h3>Surat Jalan</h3>
          </div>
          <Link href="/delivery-orders/create">
            <Button variant="primary" size="sm">+ Buat Surat Jalan</Button>
          </Link>
        </div>
        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat surat jalan...</div>
          ) : notes.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              <h4>Tidak ada surat jalan</h4>
              <p>Anda belum membuat surat jalan apapun.</p>
              <Link href="/delivery-orders/create" style={{ display: 'inline-block', marginTop: 12 }}>
                <Button variant="primary" size="sm">Buat Surat Jalan Pertama</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>No. SJ</th>
                  <th>Outlet Tujuan</th>
                  <th>Tanggal Kirim</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {notes.map(n => (
                  <tr 
                    key={n.id} 
                    onClick={() => router.push(`/delivery-orders/${n.id}`)}
                    style={{ cursor: 'pointer' }}
                    className="hover-bg-muted"
                  >
                    <td className="font-mono text-primary font-bold">{n.delivery_note_number}</td>
                    <td className="font-bold">{n.outlet_name}</td>
                    <td>{new Date(n.delivery_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                    <td className="center">
                      <Badge variant={n.status === 'DITERIMA' ? 'green' : n.status === 'DIKIRIM' ? 'blue' : 'gray'}>
                        {n.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </section>
  );
}

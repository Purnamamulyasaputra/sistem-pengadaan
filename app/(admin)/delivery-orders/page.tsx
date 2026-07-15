'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
        <div className="tabs" style={{ marginBottom: 0 }}>
          <a href="/warehouse" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Goods Receipts</a>
          <a href="/stock-card" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Stock Card</a>
          <a href="/delivery-orders" className="tab active" style={{ textDecoration: 'none' }}>Delivery Orders</a>
          <a href="/opname/central" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Central Opname</a>
        </div>
        <div className="card-head">
          <div>
            <h3>Delivery Orders</h3>
          </div>
          <Link href="/delivery-orders/create">
            <Button variant="primary" size="sm">+ Create Delivery Order</Button>
          </Link>
        </div>
        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading delivery orders...</div>
          ) : notes.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              <h4>No delivery orders</h4>
              <p>You haven't created any delivery orders yet.</p>
              <Link href="/delivery-orders/create" style={{ display: 'inline-block', marginTop: 12 }}>
                <Button variant="primary" size="sm">Create First DO</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>DO No.</th>
                  <th>Destination Outlet</th>
                  <th>Delivery Date</th>
                  <th className="center">Status</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {notes.map(n => (
                  <tr key={n.id}>
                    <td className="font-mono text-primary font-bold">{n.delivery_note_number}</td>
                    <td className="font-bold">{n.outlet_name}</td>
                    <td>{new Date(n.delivery_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                    <td className="center">
                      <Badge variant={n.status === 'DITERIMA' ? 'green' : n.status === 'DIKIRIM' ? 'blue' : 'gray'}>
                        {n.status}
                      </Badge>
                    </td>
                    <td className="right">
                      <Link href={`/delivery-orders/${n.id}`}>
                        <Button size="sm" style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>View & Scan</Button>
                      </Link>
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

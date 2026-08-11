'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search, MapPin } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';


interface DirectPurchase {
  id: number;
  purchase_date: string;
  receipt_number: string;
  total_amount: string;
  notes: string;
  created_by_name: string;
  item_count: string;
}

export default function DirectPurchasesPage() {
  const [purchases, setPurchases] = useState<DirectPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/direct-purchases');
      if (res.ok) {
        const data = await res.json();
        setPurchases(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const filtered = purchases.filter(p => 
    p.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.notes?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Belanja Pasar</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Catat pengeluaran tunai untuk belanja langsung ke pasar atau toko lokal.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 250, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} />
              <input 
                type="text"
                placeholder="Cari referensi atau catatan..."
                className="input"
                style={{ width: '100%', paddingLeft: 36 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Link href="/direct-purchases/create">
              <Button variant="primary" size="sm">+ Catat Belanja Baru</Button>
            </Link>
          </div>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div className="muted center" style={{ padding: 40 }}>Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <MapPin size={40} style={{ margin: '0 auto 16px', color: 'var(--muted)' }} />
              <h4>Tidak ada riwayat belanja</h4>
              <p>Belum ada catatan belanja langsung.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table>
                <thead>
                  <tr>
                    <th>Tanggal Belanja</th>
                    <th>No. Referensi / Nota</th>
                    <th>Oleh</th>
                    <th className="center">Total Item</th>
                    <th className="right">Total Nominal</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td className="font-bold">
                        {new Date(p.purchase_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <div className="font-bold text-primary">{p.receipt_number || '-'}</div>
                      </td>
                      <td>{p.created_by_name}</td>
                      <td className="center">
                        <Badge variant="gray">{p.item_count} Jenis</Badge>
                      </td>
                      <td className="right font-bold">
                        Rp {Number(p.total_amount).toLocaleString('id-ID')}
                      </td>
                      <td className="muted" style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

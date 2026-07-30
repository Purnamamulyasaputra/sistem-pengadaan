'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface Alert {
  id: number;
  item_id: number;
  item_name: string;
  category_name: string;
  smallest_unit: string;
  current_balance: number;
  threshold_at_alert: number;
  minimum_threshold: number;
  created_at: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/alerts?resolved=false');
    const data = await res.json();
    setAlerts(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleResolve = async (id: number) => {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/alerts/${id}/resolve`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || 'Failed to resolve alert');
      } else {
        fetchAlerts(); // refresh
      }
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Peringatan Stok Gudang</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>
              Daftar barang yang jumlah stoknya sudah berada di bawah batas minimum (Reorder Point).
            </p>
          </div>
          {alerts.length > 0 && (
            <Link href={`/purchase-orders?create_items=${alerts.map(a => a.item_id).join(',')}`}>
              <Button variant="primary" style={{ background: '#016e3f', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Buat PO untuk Semua
              </Button>
            </Link>
          )}
        </div>
        
        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
          ) : alerts.length === 0 ? (
            <div className="empty-state" style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ color: '#16a34a', marginBottom: 16 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h4>Semua stok aman</h4>
              <p className="muted">Saat ini tidak ada barang yang stoknya berada di bawah batas minimum.</p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Barang</th>
                  <th>Kategori</th>
                  <th className="right">Stok Saat Ini</th>
                  <th className="right">Batas Minimum</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => {
                  const threshold = a.threshold_at_alert || a.minimum_threshold || 1;
                  const stockPct = (Number(a.current_balance) / threshold) * 100;
                  
                  return (
                    <tr key={a.id}>
                      <td>{new Date(a.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="font-bold">{a.item_name}</td>
                      <td className="muted">{a.category_name}</td>
                      <td className="right">
                        <span style={{ color: '#dc2626', fontWeight: 700 }}>
                          {Number(a.current_balance).toFixed(2)}
                        </span>
                        <span className="muted" style={{ marginLeft: 4 }}>{a.smallest_unit}</span>
                      </td>
                      <td className="right font-bold">
                        {Number(a.threshold_at_alert || a.minimum_threshold || 0).toFixed(2)} <span className="muted">{a.smallest_unit}</span>
                      </td>
                      <td className="center">
                        <Badge variant={stockPct <= 0 ? 'red' : 'amber'}>
                          {stockPct <= 0 ? 'Stok Kosong' : 'Stok Menipis'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </section>
  );
}

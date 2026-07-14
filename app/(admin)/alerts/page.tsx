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
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Reorder Point Alerts</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>
              Items that have fallen below their minimum stock threshold.
            </p>
          </div>
        </div>
        
        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="empty-state" style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ color: '#16a34a', marginBottom: 16 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h4>All item stocks are safe</h4>
              <p className="muted">There are no items currently below the minimum stock threshold.</p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Alert Date</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="right">Current Stock</th>
                  <th className="right">Threshold</th>
                  <th className="center">Status</th>
                  <th className="right">Actions</th>
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
                          {stockPct <= 0 ? 'Stock Empty' : 'Low Stock'}
                        </Badge>
                      </td>
                      <td className="right">
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <Link href={`/purchase-orders/create?item=${a.item_id}`}>
                            <Button variant="outline" size="sm">Create PO</Button>
                          </Link>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => handleResolve(a.id)}
                            disabled={resolvingId === a.id}
                          >
                            {resolvingId === a.id ? 'Resolving...' : 'Mark Resolved'}
                          </Button>
                        </div>
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

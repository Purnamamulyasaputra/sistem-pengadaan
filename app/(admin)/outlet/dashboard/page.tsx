'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';

interface Order {
  id: number; order_date: string; delivery_date: string;
  status: string; item_count: number; created_by_name: string;
}

export default function OutletDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // In a real app, outlet_id would come from the logged-in user's session
  const OUTLET_ID = 1; // Hardcoded for Phase 1 demo

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    // Fetch recent orders for this outlet
    const res = await fetch(`/api/orders?outletId=${OUTLET_ID}&limit=5`);
    if (res.ok) {
      const data = await res.json();
      setOrders(data.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const activeRequests = orders.filter(o => ['PENDING', 'PROCESSING'].includes(o.status)).length;
  const awaitingDelivery = orders.filter(o => o.status === 'SHIPPED').length;

  return (
    <section className="screen">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 8px 0', fontFamily: 'var(--font-cabin)' }}>Outlet Dashboard</h2>
        <p className="muted" style={{ margin: 0 }}>Overview of your recent requests and upcoming activities.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ padding: 24, borderLeft: '4px solid var(--primary)' }}>
          <h4 className="muted" style={{ margin: '0 0 12px 0', fontSize: 14 }}>Active Requests</h4>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-cabin)' }}>{activeRequests}</div>
          <div style={{ marginTop: 12 }}>
            <Link href="/outlet/requests" style={{ fontSize: 13, fontWeight: 600 }}>View all requests &rarr;</Link>
          </div>
        </div>
        <div className="card" style={{ padding: 24, borderLeft: '4px solid #f59e0b' }}>
          <h4 className="muted" style={{ margin: '0 0 12px 0', fontSize: 14 }}>Awaiting Delivery</h4>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-cabin)' }}>{awaitingDelivery}</div>
          <div style={{ marginTop: 12 }}>
            <Link href="/outlet/receive-goods" style={{ fontSize: 13, fontWeight: 600 }}>Receive Goods &rarr;</Link>
          </div>
        </div>
        <div className="card" style={{ padding: 24, borderLeft: '4px solid #3b82f6' }}>
          <h4 className="muted" style={{ margin: '0 0 12px 0', fontSize: 14 }}>Next Stock Opname</h4>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-cabin)' }}>End of Month</div>
          <div style={{ marginTop: 12 }}>
            <Link href="/outlet/opname" style={{ fontSize: 13, fontWeight: 600 }}>Start Opname &rarr;</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Recent Requests</h3>
          </div>
          <Link href="/outlet/requests/create">
            <Button variant="primary" size="sm">+ Create Request</Button>
          </Link>
        </div>
        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading dashboard data...</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /></svg>
              <h4>No recent requests</h4>
              <p>You haven't made any requests recently.</p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>PO No.</th>
                  <th>Order Date</th>
                  <th>Expected Delivery</th>
                  <th className="center">Total Items</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td className="font-mono text-primary font-bold">PO-{new Date(o.order_date).getFullYear()}-{String(o.id).padStart(5, '0')}</td>
                    <td>{new Date(o.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>{new Date(o.delivery_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="center num font-bold">{o.item_count}</td>
                    <td className="center"><OrderStatusBadge status={o.status} /></td>
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

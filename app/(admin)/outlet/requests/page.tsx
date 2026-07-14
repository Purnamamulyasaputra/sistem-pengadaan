'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';

interface Order {
  id: number; order_date: string; delivery_date: string;
  status: string; item_count: number; created_by_name: string;
}
interface OrderItem {
  id: number; order_id: number; item_name: string; category_name: string;
  purchase_unit: string; smallest_unit: string; qty_request: number; smallest_unit_qty: number;
  fulfillment_status: string; item_status: string;
}

const ITEM_STATUS_LABELS: Record<string, string> = {
  DITERIMA_DARI_OUTLET: 'Submitted', PROSES_BELANJA: 'Purchasing',
  READY_DI_GUDANG: 'Ready in WH', DIKIRIM: 'Shipped', SELESAI: 'Completed',
};

export default function OutletRequestsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<{ order: Order; items: OrderItem[] } | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/orders`);
    const data = await res.json();
    setOrders(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleViewOrder(order: Order) {
    setSelectedOrder({ order, items: [] });
    // Fetch items for this order
    const iRes = await fetch(`/api/orders/recap?order_id=${order.id}`);
    if (iRes.ok) {
      const iData = await iRes.json();
      setSelectedOrder({ order, items: iData.data ?? [] });
    }
  }

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Purchase Request Outlet</h3>
          </div>
        </div>
        <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '16px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link href="/outlet/requests/create" style={{ textDecoration: 'none' }}>
            <Button variant="outline" style={{ background: 'white', borderColor: '#86efac' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M12 5v14M5 12h14" /></svg>
              Create Request
            </Button>
          </Link>
          <Link href="/outlet/requests" style={{ textDecoration: 'none' }}>
            <Button variant="primary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
              Request History
            </Button>
          </Link>
          <Link href="/outlet/receive-goods" style={{ textDecoration: 'none' }}>
            <Button variant="outline" style={{ background: 'white', borderColor: '#86efac' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              Receive Goods
            </Button>
          </Link>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading data...</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /></svg>
              <h4>No requests yet</h4>
              <p>You haven't created any item requests yet.</p>
              <Link href="/outlet/requests/create" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 12 }}>
                <Button variant="primary" size="sm">Create Now</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>PO No.</th><th>Created By</th>
                  <th>Order Date</th><th>Expected Delivery</th>
                  <th className="center">Total Items</th><th className="center">Status</th><th className="right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td className="font-mono text-primary font-bold">PO-{new Date(o.order_date).getFullYear()}-{String(o.id).padStart(5, '0')}</td>
                    <td className="muted">{o.created_by_name}</td>
                    <td>{new Date(o.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>{new Date(o.delivery_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="center num font-bold">{o.item_count}</td>
                    <td className="center"><OrderStatusBadge status={o.status} /></td>
                    <td className="right">
                      <Button size="sm" onClick={() => handleViewOrder(o)} title="Detail" style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Request Detail PO-${selectedOrder ? new Date(selectedOrder.order.order_date).getFullYear() + '-' + String(selectedOrder.order.id).padStart(5, '0') : ''}`} maxWidth={900}>
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          <p className="muted" style={{ marginBottom: 20 }}>Created on {selectedOrder ? new Date(selectedOrder.order.order_date).toLocaleDateString('id-ID') : ''}</p>

        <div style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
          {selectedOrder?.items?.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
              Item data is empty or not found.
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Item</th><th>Category</th><th className="right">Qty Requested</th>
                  <th className="center">Fulfillment</th><th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder?.items?.map(item => (
                  <tr key={item.id}>
                    <td className="font-bold">{item.item_name}</td>
                    <td className="muted">{item.category_name}</td>
                    <td className="right">
                      <div className="font-bold num">{parseFloat(Number(item.qty_request).toFixed(3)).toLocaleString('id-ID')} {item.purchase_unit}</div>
                    </td>
                    <td className="center">
                      <Badge variant={item.fulfillment_status === 'SANGGUP' ? 'green' : item.fulfillment_status === 'TIDAK' ? 'red' : 'amber'}>
                        {item.fulfillment_status === 'SANGGUP' ? 'Available' : item.fulfillment_status === 'TIDAK' ? 'Unavailable' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="center">
                      <Badge variant="gray">{ITEM_STATUS_LABELS[item.item_status] ?? item.item_status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        </div>
        <div className="modal-actions" style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="primary" onClick={() => setSelectedOrder(null)}>Close</Button>
        </div>
      </Modal>
    </section>
  );
}

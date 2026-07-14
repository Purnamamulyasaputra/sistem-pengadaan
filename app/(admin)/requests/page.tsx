'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';

interface Order {
  id: number; outlet_name: string; order_date: string; delivery_date: string;
  status: string; item_count: number; created_by_name: string;
}
interface OrderItem {
  id: number; order_id: number; item_name: string; category_name: string;
  purchase_unit: string; smallest_unit: string; qty_request: number; smallest_unit_qty: number;
  fulfillment_status: string; item_status: string; distribution_price?: number;
  additional_notes?: string; current_average_price?: number; current_stock?: number;
  conversion_ratio?: number;
}

const ITEM_STATUS_LABELS: Record<string, string> = {
  DITERIMA_DARI_OUTLET: 'Submitted', PROSES_BELANJA: 'Purchasing',
  READY_DI_GUDANG: 'Ready in WH', DIKIRIM: 'Shipped', SELESAI: 'Completed',
};

function formatDate(dateString: string) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

const getFulfillmentStyle = (val: string) => {
  if (val === 'SANGGUP') return { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0', fontWeight: 'bold' };
  if (val === 'TIDAK') return { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fecaca', fontWeight: 'bold' };
  return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0', fontWeight: 'bold' };
};

const getStatusStyle = (val: string) => {
  if (val === 'READY_DI_GUDANG') return { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0', fontWeight: 'bold' };
  if (val === 'PROSES_BELANJA') return { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde68a', fontWeight: 'bold' };
  if (val === 'SELESAI') return { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#bfdbfe', fontWeight: 'bold' };
  return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0', fontWeight: 'bold' };
};

function RequestsContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState<number | null>(null);

  const searchParams = useSearchParams();
  const openId = searchParams.get('open_id');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/orders?${params}`);
    const data = await res.json();
    setOrders(data.data ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleViewOrder = useCallback(async (order: Order) => {
    setSelectedOrder({ order, items: [] });
    // Load items
    const iRes = await fetch(`/api/orders/recap?order_id=${order.id}`);
    if (iRes.ok) {
      const iData = await iRes.json();
      setSelectedOrder({ order, items: iData.data ?? [] });
    }
  }, []);

  useEffect(() => {
    if (!loading && openId && orders.length > 0) {
      const orderToOpen = orders.find(o => String(o.id) === openId);
      if (orderToOpen) {
        handleViewOrder(orderToOpen);
      }
    }
  }, [loading, openId, orders, handleViewOrder]);

  async function handleUpdateItem(orderItemId: number, updates: Record<string, unknown>) {
    setSaving(orderItemId);
    try {
      await fetch(`/api/orders/${orderItemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      fetchOrders();
      if (selectedOrder) {
        setSelectedOrder(prev => prev ? {
          ...prev,
          items: prev.items.map(i => i.id === orderItemId ? { ...i, ...updates } : i)
        } : null);
      }
    } finally { setSaving(null); }
  }

  async function handleAutoAssess() {
    if (!selectedOrder) return;
    const itemsToUpdate = selectedOrder.items.filter(i => i.item_status === 'DITERIMA_DARI_OUTLET');

    if (itemsToUpdate.length === 0) {
      alert('Semua barang sudah di-assess (tidak ada yang berstatus Diterima).');
      return;
    }

    setSaving(-1); // Use -1 to indicate bulk saving
    try {
      const updatePromises = itemsToUpdate.map(async (item) => {
        const stock = Number(item.current_stock ?? 0);
        const reqQty = Number(item.smallest_unit_qty ?? 0);

        let newStatus = 'TIDAK';
        let newItemStatus = 'PROSES_BELANJA';

        if (stock >= reqQty) {
          newStatus = 'SANGGUP';
          newItemStatus = 'READY_DI_GUDANG';
        }

        const updates = { fulfillment_status: newStatus, item_status: newItemStatus };

        await fetch(`/api/orders/${item.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        return { id: item.id, ...updates };
      });

      const results = await Promise.all(updatePromises);

      setSelectedOrder(prev => {
        if (!prev) return null;
        const newItems = [...prev.items];
        results.forEach(res => {
          const idx = newItems.findIndex(i => i.id === res.id);
          if (idx !== -1) newItems[idx] = { ...newItems[idx], fulfillment_status: res.fulfillment_status, item_status: res.item_status };
        });
        return { ...prev, items: newItems };
      });
      fetchOrders();
    } catch (e) {
      alert('Terjadi kesalahan saat Auto-Assess');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Request Recap</h3>
          </div>
          <select className="input" style={{ width: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="SHIPPED">Shipped</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading data...</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /></svg>
              <h4>No requests</h4>
              <p>No incoming requests from outlets yet</p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>PO No.</th><th>Outlet</th><th>Created by</th>
                  <th>Order Date</th><th>Delivery Date</th>
                  <th className="center">Items</th><th className="center">Status</th><th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td className="font-mono text-primary font-bold">PO-{new Date(o.order_date).getFullYear()}-{String(o.id).padStart(5, '0')}</td>
                    <td className="font-bold">{o.outlet_name}</td>
                    <td className="muted">{o.created_by_name}</td>
                    <td>{formatDate(o.order_date)}</td>
                    <td>{formatDate(o.delivery_date)}</td>
                    <td className="center num font-bold">{o.item_count}</td>
                    <td className="center"><OrderStatusBadge status={o.status} /></td>
                    <td className="right">
                      <Button size="sm" onClick={() => handleViewOrder(o)} style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>Detail</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Request Detail PO-${selectedOrder ? new Date(selectedOrder.order.order_date).getFullYear() + '-' + String(selectedOrder.order.id).padStart(5, '0') : ''}`} maxWidth={1100}>
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p className="muted" style={{ margin: 0 }}>{selectedOrder?.order?.outlet_name}: {selectedOrder ? formatDate(selectedOrder.order.order_date) : ''}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoAssess}
              disabled={saving !== null}
              style={{ border: '1px solid var(--primary)', color: 'var(--primary)', background: '#dcfce7', display: 'flex', alignItems: 'center' }}
            >
              {saving === -1 ? 'Assessing stock...' : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Auto-Assess from Stock
                </>
              )}
            </Button>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {selectedOrder?.items?.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                Item data is empty or not found.
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Item</th><th>Category</th><th className="right">Qty</th>
                    <th className="right">Current Stock</th>
                    <th>Fulfillment</th><th>Status</th>
                    <th></th>
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
                      <td className="right">
                        <div className="font-bold num" style={{ color: Number(item.current_stock) >= item.smallest_unit_qty ? '#166534' : '#991b1b' }}>
                          {parseFloat((Number(item.current_stock ?? 0) / Number(item.conversion_ratio || 1)).toFixed(3)).toLocaleString('id-ID')} {item.purchase_unit}
                        </div>
                      </td>
                      <td>
                        <select
                          className="input"
                          style={{ height: 30, padding: '2px 8px', ...getFulfillmentStyle(item.fulfillment_status) }}
                          value={item.fulfillment_status}
                          onChange={e => handleUpdateItem(item.id, { fulfillment_status: e.target.value })}
                        >
                          <option value="MENUNGGU">Pending</option>
                          <option value="SANGGUP">Available</option>
                          <option value="TIDAK">Unavailable</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="input"
                          style={{ height: 30, padding: '2px 8px', ...getStatusStyle(item.item_status) }}
                          value={item.item_status}
                          onChange={e => handleUpdateItem(item.id, { item_status: e.target.value })}
                        >
                          {Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>
                      <td>
                        {saving === item.id && <span className="muted" style={{ fontSize: 11 }}>...</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </div>
        <div className="modal-actions" style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="primary" onClick={() => setSelectedOrder(null)}>Close & Save</Button>
        </div>
      </Modal>
    </section>
  );
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<div className="screen" style={{ padding: 40, textAlign: 'center' }}>Loading...</div>}>
      <RequestsContent />
    </Suspense>
  );
}

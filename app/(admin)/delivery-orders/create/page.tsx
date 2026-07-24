'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Toast';

export default function CreateDeliveryOrderPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [targetOutletId, setTargetOutletId] = useState<string>('');
  const [orderItems, setOrderItems] = useState<any[]>([]);

  const [form, setForm] = useState({
    delivery_date: new Date().toISOString().split('T')[0],
    driver_name: '',
  });

  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch orders that are PROCESSING or READY
    async function fetchOrders() {
      const res = await fetch('/api/orders/recap');
      const data = await res.json();

      // Group items by order to get the orders list, filtering for ones that need shipping
      const uniqueOrders = new Map();
      (data.data ?? []).forEach((item: any) => {
        if (['PROSES_BELANJA', 'READY_DI_GUDANG'].includes(item.item_status)) {
          if (!uniqueOrders.has(item.order_id)) {
            uniqueOrders.set(item.order_id, {
              order_id: item.order_id,
              outlet_id: item.outlet_id,
              outlet_name: item.outlet_name,
              order_date: item.order_date,
              items: []
            });
          }
          uniqueOrders.get(item.order_id).items.push(item);
        }
      });

      setOrders(Array.from(uniqueOrders.values()));
    }
    async function fetchOutlets() {
      const res = await fetch('/api/outlets');
      const data = await res.json();
      setOutlets(data.data ?? []);
    }
    fetchOrders();
    fetchOutlets();
  }, []);

  const handleSelectOrder = (id: string) => {
    setSelectedOrderId(id);
    if (!id) {
      setOrderItems([]);
      setTargetOutletId('');
      return;
    }

    const selected = orders.find(o => String(o.order_id) === id);
    if (selected) {
      setTargetOutletId(String(selected.outlet_id));
      setOrderItems(selected.items.map((i: any) => ({
        ...i,
        qty_shipped: (() => {
          const u = (i.smallest_unit || '').toLowerCase();
          const ratio = (u === 'ml' || u === 'gr' || u === 'g') ? 1000 : 1;
          return parseFloat(Number(i.qty_request / ratio).toFixed(3));
        })(),
        current_stock: parseFloat(i.current_stock ?? '0'),
        selected: i.item_status === 'READY_DI_GUDANG',
        keterangan: ''
      })));
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && orders.length > 0 && !selectedOrderId) {
      const urlParams = new URLSearchParams(window.location.search);
      const qId = urlParams.get('order_id');
      if (qId && orders.some(o => String(o.order_id) === qId)) {
        handleSelectOrder(qId);
      }
    }
  }, [orders]);

  const handleToggleItem = (orderItemId: number) => {
    setOrderItems(orderItems.map(i => i.order_item_id === orderItemId ? { ...i, selected: !i.selected } : i));
  };

  const handleQtyChange = (orderItemId: number, val: string) => {
    setOrderItems(orderItems.map(i => i.order_item_id === orderItemId ? { ...i, qty_shipped: parseFloat(val) || 0 } : i));
  };

  const handleKeteranganChange = (orderItemId: number, val: string) => {
    setOrderItems(orderItems.map(i => i.order_item_id === orderItemId ? { ...i, keterangan: val } : i));
  };

  const handleSave = async () => {
    const selectedItems = orderItems.filter(i => i.selected && i.qty_shipped > 0);
    if (selectedItems.length === 0) {
      setError('Please select at least one valid item to ship.');
      return;
    }

    const overStockItems = selectedItems.filter(i => (i.qty_shipped * (Number(i.conversion_ratio) || 1)) > i.current_stock);
    if (overStockItems.length > 0) {
      const names = overStockItems.map(i => i.item_name).join(', ');
      setError(`Stock insufficient for: ${names}. Please reduce the Qty to Ship.`);
      return;
    }

    const orderData = orders.find(o => String(o.order_id) === selectedOrderId);
    if (!orderData) return;

    setSaving(true);
    setError('');

    try {
      const payload = {
        order_id: orderData.order_id,
        outlet_id: Number(targetOutletId),
        driver_name: form.driver_name,
        delivery_date: form.delivery_date,
        items: selectedItems.map(i => ({
          order_item_id: i.order_item_id,
          item_id: i.item_id,
          qty_shipped: i.qty_shipped * (Number(i.conversion_ratio) || 1),
          price_at_shipment: i.current_average_price,
          keterangan: i.keterangan || ''
        }))
      };

      const res = await fetch('/api/delivery-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      router.push(`/delivery-orders/${data.data.id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <section className="screen">
      <div className="card" style={{ maxWidth: 1000 }}>
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Create Delivery Order</h3>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/delivery-orders">
              <Button variant="outline" size="sm">Cancel</Button>
            </Link>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !selectedOrderId || orderItems.filter(i => i.selected).length === 0}>
              {saving ? 'Creating DO...' : 'Generate Delivery Order'}
            </Button>
          </div>
        </div>

        <div className="card-body flush" style={{ padding: 24 }}>
          <Toast 
            isOpen={!!error} 
            message={error} 
            type="error" 
            onClose={() => setError('')} 
          />

          <div className="form-grid" style={{ marginBottom: 32 }}>
            <div className="form-group">
              <label className="req">Source Request (PO)</label>
              <select className="input" value={selectedOrderId} onChange={e => handleSelectOrder(e.target.value)}>
                <option value="">-- Select Pending Order --</option>
                {orders.map(o => (
                  <option key={o.order_id} value={o.order_id}>
                    PO-{new Date(o.order_date).getFullYear()}-{String(o.order_id).padStart(5, '0')}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Deliver To (Outlet)</label>
              <select 
                className="input" 
                value={targetOutletId} 
                onChange={(e) => setTargetOutletId(e.target.value)}
                disabled={!selectedOrderId}
                style={{ fontWeight: 600, background: !selectedOrderId ? '#f1f5f9' : '#fff' }}
              >
                <option value="">-- Select Destination --</option>
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="req">Delivery Date</label>
              <Input
                type="date"
                value={form.delivery_date}
                min={new Date().toISOString().split('T')[0]}
                onKeyDown={(e: any) => e.preventDefault()}
                onClick={(e: any) => e.currentTarget.showPicker?.()}
                onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Driver Name</label>
              <Input type="text" placeholder="Optional" value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} />
            </div>
          </div>

          {selectedOrderId ? (
            <>
              <h4 style={{ marginBottom: 12, fontWeight: 600 }}>Items to Ship</h4>
              <Table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }} className="center" title="Select Items">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                    </th>
                    <th>Item</th>
                    <th className="center">Request Qty</th>
                    <th className="center" style={{ width: 160 }}>Qty to Ship</th>
                    <th className="center" style={{ width: 150 }}>Available Stock</th>
                    <th className="center" style={{ width: 180 }}>Keterangan</th>
                    <th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map(item => {
                    const u = (item.smallest_unit || '').toLowerCase();
                    const centralRatio = (u === 'ml' || u === 'gr' || u === 'g') ? 1000 : 1;
                    const centralUnit = u === 'ml' ? 'Liter' : (u === 'gr' || u === 'g') ? 'Kg' : item.smallest_unit;
                    const isExceeded = (item.qty_shipped * centralRatio) > item.current_stock;
                    return (
                    <tr
                      key={item.order_item_id}
                      style={{
                        opacity: item.selected ? 1 : 0.6,
                        backgroundColor: item.selected ? (isExceeded ? '#fef2f2' : '#f8fafc') : '#fafafa',
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      <td className="center">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleToggleItem(item.order_item_id)}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />
                      </td>
                      <td className="font-bold">
                        <div>{item.item_name}</div>
                        {isExceeded && item.selected && <div style={{ color: 'var(--danger)', fontSize: 11, marginTop: 4 }}>Insufficient Stock</div>}
                      </td>
                      <td className="center num font-bold">
                        {parseFloat(Number(item.qty_request / centralRatio).toFixed(3)).toLocaleString('id-ID')} {centralUnit}
                      </td>
                      <td className="center">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                          <input
                            type="number"
                            className="input right font-bold num"
                            value={item.qty_shipped}
                            onChange={(e) => handleQtyChange(item.order_item_id, e.target.value)}
                            disabled={!item.selected}
                            style={{
                              width: 90,
                              height: 32,
                              borderColor: item.selected ? (isExceeded ? 'var(--danger)' : 'var(--primary)') : 'var(--border)',
                              background: item.selected ? '#ffffff' : '#f1f5f9',
                              color: isExceeded ? 'var(--danger)' : 'inherit'
                            }}
                          />
                          <span className="muted font-bold" style={{ fontSize: 12, width: 35, textAlign: 'left' }}>{centralUnit}</span>
                        </div>
                      </td>
                      <td className="center num font-bold" style={{ color: isExceeded ? 'var(--danger)' : 'var(--muted)' }}>
                        {parseFloat((item.current_stock / centralRatio).toFixed(3)).toLocaleString('id-ID')} {centralUnit}
                      </td>
                      <td className="center">
                        <input
                          type="text"
                          className="input"
                          placeholder="Optional notes..."
                          value={item.keterangan || ''}
                          onChange={(e) => handleKeteranganChange(item.order_item_id, e.target.value)}
                          disabled={!item.selected}
                          style={{
                            width: '100%',
                            height: 32,
                            borderColor: item.selected ? 'var(--border)' : 'transparent',
                            background: item.selected ? '#ffffff' : '#f1f5f9',
                            fontSize: 12
                          }}
                        />
                      </td>
                      <td className="center">
                        <Badge variant={item.item_status === 'READY_DI_GUDANG' ? 'green' : 'amber'}>
                          {item.item_status === 'READY_DI_GUDANG' ? 'Ready' : 'Proses Belanja'}
                        </Badge>
                      </td>
                    </tr>
                    );
                  })}
                  {orderItems.length === 0 && (
                    <tr><td colSpan={6} className="center muted" style={{ padding: 32 }}>No items available to ship.</td></tr>
                  )}
                </tbody>
              </Table>

            </>
          ) : (
            <div className="muted" style={{ padding: 40, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>
              Please select a pending order to view and select items for delivery.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Item { id: number; name: string; category_name: string; purchase_unit: string; smallest_unit: string; conversion_ratio: number; }
interface RequestLine { id: number; item_id: number; name: string; uom: string; qty: number; note: string; smallest_unit: string; ratio: number; }

export default function CreateRequestPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<RequestLine[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');

  const [orderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Hardcoded for Phase 1 demo
  const OUTLET_ID = 1;
  const CREATED_BY = 2; // Assuming 2 is an outlet admin

  useEffect(() => {
    fetch('/api/items').then(r => r.json()).then(d => setItems(d.data ?? []));
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setDeliveryDate(d.toISOString().split('T')[0]);
  }, []);

  const addItem = () => {
    if (!selectedItemId) {
      alert("Please select an item from the list!");
      return;
    }
    const foundItem = items.find(i => i.id === selectedItemId);
    if (!foundItem) {
      alert("Item not found.");
      return;
    }
    const exists = cart.some(c => c.item_id === foundItem.id);
    if (exists) {
      alert("Item already exists in the cart.");
      return;
    }
    const isSmallest = selectedUnit === foundItem.smallest_unit && selectedUnit !== foundItem.purchase_unit;
    setCart([...cart, {
      id: Date.now(),
      item_id: foundItem.id,
      name: foundItem.name,
      uom: selectedUnit,
      smallest_unit: foundItem.smallest_unit,
      ratio: isSmallest ? 1 : foundItem.conversion_ratio,
      qty: parseFloat(qty) || 1,
      note
    }]);
    setSearchTerm(''); setSelectedItemId(null); setSelectedUnit(''); setQty(''); setNote('');
  };

  const updateCartQty = (id: number, val: string) => {
    setCart(cart.map(c => c.id === id ? { ...c, qty: parseFloat(val) || 1 } : c));
  };

  const removeCartItem = (id: number) => {
    setCart(cart.filter(c => c.id !== id));
  };

  async function handleSubmit() {
    if (!deliveryDate) { setError('Delivery date is required.'); return; }
    if (!cart.length) { setError('Cart is empty.'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: OUTLET_ID,
          order_date: orderDate,
          delivery_date: deliveryDate,
          created_by: CREATED_BY,
          items: cart.map(l => {
            const itemData = items.find(i => i.id === l.item_id);
            const isSmallest = l.uom === itemData?.smallest_unit && l.uom !== itemData?.purchase_unit;
            const ratio = itemData?.conversion_ratio || 1;
            const finalQty = isSmallest ? l.qty / ratio : l.qty;
            return { item_id: l.item_id, qty_request: finalQty, additional_notes: l.note };
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || 'Failed to submit request'); return; }
      router.push('/outlet/requests');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
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
            <Button variant="primary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M12 5v14M5 12h14" /></svg>
              Create Request
            </Button>
          </Link>
          <Link href="/outlet/requests" style={{ textDecoration: 'none' }}>
            <Button variant="outline" style={{ background: 'white', borderColor: '#86efac' }}>
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

        <div className="card-body">
          {error && <div className="alert-banner alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

          <div className="form-grid" style={{ marginBottom: 30, maxWidth: 600 }}>
            <div className="form-group">
              <label>Order Date</label>
              <Input type="date" value={orderDate} disabled />
            </div>
            <div className="form-group">
              <label>Expected Delivery</label>
              <Input
                type="date"
                value={deliveryDate}
                min={orderDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                onKeyDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  try { (e.target as HTMLInputElement).showPicker(); } catch (err) { }
                }}
              />
            </div>
          </div>

          <h4 style={{ marginBottom: 12 }}>Add Items</h4>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 2, position: 'relative' }}>
              <Input
                type="text"
                placeholder="Type to search item..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); setSelectedItemId(null); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              />
              {showDropdown && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(i => (
                    <div
                      key={i.id}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}
                      onMouseDown={() => { setSearchTerm(i.name); setSelectedItemId(i.id); setSelectedUnit(i.purchase_unit); setShowDropdown(false); }}
                      onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {i.name} <span className="muted">({i.purchase_unit})</span>
                    </div>
                  ))}
                  {items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                    <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                      No items found
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <Input
                type="number"
                placeholder="Qty"
                value={qty}
                onChange={e => setQty(e.target.value)}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                style={{ width: '100%' }}
              />
              {selectedItemId && qty && (
                <div style={{ position: 'absolute', top: '100%', left: 0, fontSize: 11, color: 'var(--muted)', marginTop: 4, whiteSpace: 'nowrap' }}>
                  {(() => {
                    const item = items.find(i => i.id === selectedItemId);
                    if (!item || item.conversion_ratio === 1) return null;
                    const isSmallest = selectedUnit === item.smallest_unit && selectedUnit !== item.purchase_unit;
                    if (isSmallest) return null;
                    const total = parseFloat(qty) * item.conversion_ratio;
                    return `≈ ${Number.isInteger(total) ? total : total.toFixed(1)} ${item.smallest_unit}`;
                  })()}
                </div>
              )}
            </div>
            <div style={{ width: 100 }}>
              <select
                className="input"
                disabled={!selectedItemId}
                value={selectedUnit}
                onChange={e => setSelectedUnit(e.target.value)}
                style={{ width: '100%', appearance: 'none', background: !selectedItemId ? '#f8fafc' : 'white', color: 'var(--foreground)' }}
              >
                {!selectedItemId && <option value="">Unit</option>}
                {selectedItemId && (() => {
                  const item = items.find(i => i.id === selectedItemId);
                  if (!item) return null;
                  const opts = [<option key={item.purchase_unit} value={item.purchase_unit}>{item.purchase_unit}</option>];
                  if (item.smallest_unit && item.smallest_unit !== item.purchase_unit) {
                    opts.push(<option key={item.smallest_unit} value={item.smallest_unit}>{item.smallest_unit}</option>);
                  }
                  return opts;
                })()}
              </select>
            </div>
            <Input type="text" placeholder="Notes (Optional)" value={note} onChange={e => setNote(e.target.value)} style={{ flex: 2 }} />
            <Button variant="primary" onClick={addItem}>Add to Cart</Button>
          </div>

          <Table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th className="right" style={{ width: 120 }}>Qty Request</th>
                <th>Purchasing Unit</th>
                <th className="muted" style={{ width: 180 }}>Conversion Preview</th>
                <th>Notes</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cart.map(c => (
                <tr key={c.id}>
                  <td className="font-bold">{c.name}</td>
                  <td>
                    <input type="number" className="input right" value={c.qty} onChange={(e) => updateCartQty(c.id, e.target.value)} onWheel={(e) => e.currentTarget.blur()} style={{ height: 32, width: '100%' }} />
                  </td>
                  <td>{c.uom}</td>
                  <td className="muted" style={{ fontSize: 13 }}>
                    {c.uom !== c.smallest_unit ? `= ${c.qty * c.ratio} ${c.smallest_unit}` : '-'}
                  </td>
                  <td>{c.note}</td>
                  <td className="center">
                    <Button size="sm" onClick={() => removeCartItem(c.id)} title="Delete" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </Button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr><td colSpan={6} className="center muted" style={{ padding: 40 }}>Your cart is empty.</td></tr>
              )}
            </tbody>
          </Table>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={() => setShowConfirm(true)} disabled={submitting || cart.length === 0}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Submit Purchase Request"
        message={`Are you sure you want to submit this request with ${cart.length} item(s)?`}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        confirmText="Yes, Submit"
        cancelText="Cancel"
      />
    </section>
  );
}

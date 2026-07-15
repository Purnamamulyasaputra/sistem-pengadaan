'use client';
import { useState, useEffect } from 'react';
import { Toast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ChevronLeft } from 'lucide-react';

interface Item { id: number; name: string; category_name: string; purchase_unit: string; smallest_unit: string; conversion_ratio: number; }
interface RequestLine { id: number; item_id: number | null; name: string; uom: string; qty: string; note: string; smallest_unit: string; purchase_unit: string; ratio: number; }

export default function CreateRequestPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<RequestLine[]>([]);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' as 'success'|'error'|'info' });

  const [orderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Hardcoded for Phase 1 demo
  const OUTLET_ID = 1;
  const CREATED_BY = 2; // Assuming 2 is an outlet admin

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const itemsRes = await fetch('/api/items');
        const itemsJson = await itemsRes.json();
        const itemsList = itemsJson.data ?? [];
        setItems(itemsList);

        const invRes = await fetch('/api/outlet/inventory');
        const invJson = await invRes.json();
        
        if (invJson.success && invJson.data) {
          const lowStockItems = invJson.data
            .filter((d: any) => {
              if (d.minimum_threshold === null) return false;
              const effectiveBalance = Number(d.current_balance || 0) + Number(d.incoming_balance || 0);
              // Only auto-add if effective balance is completely below minimum (don't auto add if they already ordered)
              return effectiveBalance <= d.minimum_threshold && Number(d.incoming_balance || 0) === 0;
            })
            .map((d: any) => {
              const effectiveBalance = Number(d.current_balance || 0) + Number(d.incoming_balance || 0);
              let shortage = d.minimum_threshold - effectiveBalance;
              if (shortage <= 0) shortage = d.minimum_threshold;
              
              const matchedMaster = itemsList.find((i: any) => i.id === d.item_id);
              if (!matchedMaster) return null;

              return {
                id: Date.now() + Math.random(),
                item_id: d.item_id,
                name: d.item_name,
                uom: d.smallest_unit,
                smallest_unit: d.smallest_unit,
                purchase_unit: matchedMaster.purchase_unit,
                ratio: 1, 
                qty: shortage.toString(),
                note: 'Low Stock Auto-Add'
              };
            })
            .filter(Boolean);

          if (lowStockItems.length > 0) {
             setCart(lowStockItems);
             setToast({ open: true, message: `${lowStockItems.length} item Low Stock otomatis ditambahkan!`, type: 'info' });
          }
        }
      } catch (e) {
         console.error(e);
      }
    };
    fetchAll();

    const d = new Date();
    d.setDate(d.getDate() + 3);
    setDeliveryDate(d.toISOString().split('T')[0]);
  }, []);

  const addEmptyRow = () => {
    setCart([...cart, {
      id: Date.now() + Math.random(),
      item_id: null,
      name: '',
      uom: '',
      smallest_unit: '',
      purchase_unit: '',
      ratio: 1,
      qty: '',
      note: ''
    }]);
  };

  const updateCartItemSelect = (rowId: number, selectedItemId: string) => {
    const id = parseInt(selectedItemId);
    const item = items.find(i => i.id === id);
    if (!item) return;

    setCart(cart.map(c => c.id === rowId ? {
      ...c,
      item_id: item.id,
      name: item.name,
      uom: item.purchase_unit,
      smallest_unit: item.smallest_unit,
      purchase_unit: item.purchase_unit,
      ratio: item.conversion_ratio
    } : c));
  };

  const updateCartQty = (id: number, val: string) => {
    const numericVal = val.replace(/[^0-9.]/g, '');
    setCart(cart.map(c => c.id === id ? { ...c, qty: numericVal } : c));
  };

  const updateCartNote = (id: number, val: string) => {
    setCart(cart.map(c => c.id === id ? { ...c, note: val } : c));
  };

  const updateCartUnit = (id: number, val: string) => {
    setCart(cart.map(c => c.id === id ? { ...c, uom: val } : c));
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
          items: cart.filter(l => l.item_id !== null && parseFloat(l.qty) > 0).map(l => {
            const itemData = items.find(i => i.id === l.item_id);
            const isSmallest = l.uom === itemData?.smallest_unit && l.uom !== itemData?.purchase_unit;
            const ratio = itemData?.conversion_ratio || 1;
            const floatQty = parseFloat(l.qty) || 0;
            const finalQty = isSmallest ? floatQty / ratio : floatQty;
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
      <Toast isOpen={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({...toast, open: false})} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn" onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
          <ChevronLeft size={18} /> Back
        </button>
        <div>
          <h2 style={{ margin: 0 }}>Create Manual Request</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Create a purchase request manually or review auto-suggested low stock items.
          </div>
        </div>
      </div>

      <div className="card">

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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Items</h4>
            <Button variant="outline" size="sm" onClick={addEmptyRow} style={{ borderColor: '#86efac', background: '#f0fdf4' }}>
              + Tambah Data
            </Button>
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
                  <td className={c.item_id ? "font-bold" : ""}>
                    {!c.item_id ? (
                      <select className="input" style={{ width: '100%', maxWidth: 300 }} value={c.item_id || ''} onChange={e => updateCartItemSelect(c.id, e.target.value)}>
                        <option value="">-- Pilih Barang --</option>
                        {items.map(i => (
                          <option key={i.id} value={i.id} disabled={cart.some(cartItem => cartItem.item_id === i.id)}>{i.name}</option>
                        ))}
                      </select>
                    ) : c.name}
                  </td>
                  <td>
                    <input type="text" className="input right" value={c.qty} onChange={(e) => updateCartQty(c.id, e.target.value)} style={{ height: 32, width: '100%', minWidth: 60 }} placeholder="0" />
                  </td>
                  <td>
                    {c.item_id ? (
                       <select className="input" value={c.uom} onChange={e => updateCartUnit(c.id, e.target.value)} style={{ width: '100%', height: 32 }}>
                          <option value={c.purchase_unit}>{c.purchase_unit}</option>
                          {c.smallest_unit && c.smallest_unit !== c.purchase_unit && (
                            <option value={c.smallest_unit}>{c.smallest_unit}</option>
                          )}
                       </select>
                    ) : '-'}
                  </td>
                  <td className="muted" style={{ fontSize: 13 }}>
                    {c.item_id && c.uom !== c.smallest_unit ? `≈ ${parseFloat(c.qty || '0') * c.ratio} ${c.smallest_unit}` : '-'}
                  </td>
                  <td>
                     <Input type="text" value={c.note} onChange={e => updateCartNote(c.id, e.target.value)} placeholder="Notes (Optional)" style={{ height: 32, minWidth: 150 }} />
                  </td>
                  <td className="center">
                    <Button size="sm" onClick={() => removeCartItem(c.id)} title="Delete" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </Button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr><td colSpan={6} className="center muted" style={{ padding: 40 }}>Your cart is empty. Click "+ Tambah Data" to add items.</td></tr>
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

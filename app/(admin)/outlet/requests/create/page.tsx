'use client';
import { useState, useEffect } from 'react';
import { Toast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Select';
import { ChevronLeft } from 'lucide-react';

interface Item { id: number; name: string; category_name: string; purchase_unit: string; smallest_unit: string; conversion_ratio: number; }
interface RequestLine { id: number; item_id: number | null; name: string; uom: string; qty: string; note: string; smallest_unit: string; purchase_unit: string; ratio: number; }

export default function CreateRequestPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<RequestLine[]>([]);
  const [activeItemIds, setActiveItemIds] = useState<number[]>([]);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' as 'success'|'error'|'info' });

  const [orderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);


  useEffect(() => {
    const fetchAll = async () => {
      try {
        const itemsRes = await fetch('/api/items');
        const itemsJson = await itemsRes.json();
        const itemsList = itemsJson.data ?? [];
        setItems(itemsList);

        // Fetch active item requests
        const activeRes = await fetch('/api/outlet/active-requests');
        const activeJson = await activeRes.json();
        const activeItemsSet = new Set(activeJson.success ? activeJson.data : []);
        setActiveItemIds(Array.from(activeItemsSet) as number[]);

        const invRes = await fetch('/api/outlet/inventory');
        const invJson = await invRes.json();
        
        if (invJson.success && invJson.data) {
          const lowStockItems = invJson.data
            .filter((d: any) => {
              if (d.minimum_threshold === null) return false;
              if (activeItemsSet.has(d.item_id)) return false; // Exclude already ordered items
              const effectiveBalance = Number(d.current_balance || 0) + Number(d.incoming_balance || 0);
              // Only auto-add if effective balance is completely below minimum (don't auto add if they already ordered)
              return effectiveBalance <= d.minimum_threshold && Number(d.incoming_balance || 0) === 0;
            })
            .map((d: any, index: number) => {
              const effectiveBalance = Number(d.current_balance || 0) + Number(d.incoming_balance || 0);
              let shortageSmall = d.minimum_threshold - effectiveBalance;
              if (shortageSmall <= 0) shortageSmall = d.minimum_threshold;
              
              const matchedMaster = itemsList.find((i: any) => i.id === d.item_id);
              if (!matchedMaster) return null;

              const ratio = Number(matchedMaster.conversion_ratio) || 1;
              const shortageLarge = Math.ceil(shortageSmall / ratio);

              return {
                id: Date.now() + index,
                item_id: d.item_id,
                name: d.item_name,
                uom: matchedMaster.purchase_unit,
                smallest_unit: d.smallest_unit,
                purchase_unit: matchedMaster.purchase_unit,
                ratio: ratio, 
                qty: shortageLarge.toString(),
                note: ''
              };
            })
            .filter(Boolean);

          if (lowStockItems.length > 0) {
             setCart(lowStockItems);
             setToast({ open: true, message: `${lowStockItems.length} item Stok Rendah otomatis ditambahkan!`, type: 'info' });
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
    setCart([{
      id: Date.now(),
      item_id: null,
      name: '',
      uom: '',
      smallest_unit: '',
      purchase_unit: '',
      ratio: 1,
      qty: '',
      note: ''
    }, ...cart]);
  };

  const updateCartItemSelect = (rowId: number, selectedItemId: string) => {
    const item = items.find(i => String(i.id) === selectedItemId);
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
    if (!deliveryDate) { setError('Tanggal pengiriman wajib diisi.'); return; }
    if (!cart.length) { setError('Keranjang kosong.'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_date: orderDate,
          delivery_date: deliveryDate,
          items: cart.filter(l => l.item_id !== null && parseFloat(l.qty) > 0).map(l => {
            const floatQty = parseFloat(l.qty) || 0;
            // The qty is already guaranteed to be in purchase_unit and rounded
            return { item_id: l.item_id, qty_request: floatQty, additional_notes: l.note };
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || 'Gagal mengirim permintaan'); return; }
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
          <ChevronLeft size={18} /> Kembali
        </button>
        <div>
          <h2 style={{ margin: 0 }}>Buat Permintaan Manual</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Buat permintaan pembelian secara manual atau tinjau saran item stok rendah otomatis.
          </div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'visible' }}>

        <div className="card-body" style={{ minHeight: 500 }}>
          {error && <div className="alert-banner alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

          <div className="form-grid" style={{ marginBottom: 30, maxWidth: 600 }}>
            <div className="form-group">
              <label>Tanggal Order</label>
              <Input type="date" value={orderDate} disabled style={{ width: 160 }} />
            </div>
            <div className="form-group">
              <label>Estimasi Kirim</label>
              <Input
                type="date"
                value={deliveryDate}
                min={orderDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                onKeyDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  try { (e.target as HTMLInputElement).showPicker(); } catch (err) { }
                }}
                style={{ width: 160 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Barang ({cart.length})</h4>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button variant="outline" size="sm" onClick={addEmptyRow} style={{ borderColor: '#86efac', background: '#f0fdf4' }}>
                + Tambah Barang
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowConfirm(true)} disabled={submitting || cart.length === 0}>
                {submitting ? 'Mengirim...' : 'Kirim Permintaan'}
              </Button>
            </div>
          </div>

          <Table responsive={false}>
            <thead>
              <tr>
                <th>Nama Barang</th>
                <th className="right" style={{ width: 120 }}>Jml Diminta</th>
                <th>Satuan Pembelian</th>
                <th className="muted" style={{ width: 180 }}>Pratinjau Konversi</th>
                <th>Catatan</th>
                <th className="center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {cart.map(c => (
                <tr key={c.id}>
                  <td className={c.item_id ? "font-bold" : ""}>
                    {!c.item_id ? (
                      <Select
                        value={c.item_id || ''}
                        onChange={val => updateCartItemSelect(c.id, String(val))}
                        options={[
                          { value: '', label: '-- Pilih Barang --' },
                          ...items.map(i => {
                            const isActive = activeItemIds.includes(i.id);
                            const inCart = cart.some(cartItem => String(cartItem.item_id) === String(i.id));
                            return {
                              value: i.id,
                              label: `${i.name}${isActive ? ' (Sedang dipesan)' : ''}`,
                              disabled: inCart || isActive
                            };
                          })
                        ]}
                        searchable
                        placeholder="-- Pilih Barang --"
                        style={{ width: '100%', maxWidth: 300 }}
                        inputStyle={{ height: 32, fontSize: 13 }}
                        optionStyle={{ fontSize: 13 }}
                      />
                    ) : c.name}
                  </td>
                  <td>
                    <input type="number" min="1" step="1" className="input right" value={c.qty} onChange={(e) => updateCartQty(c.id, e.target.value)} onWheel={(e) => (e.target as HTMLInputElement).blur()} style={{ height: 32, width: '100%', minWidth: 60 }} placeholder="0" />
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                    {c.item_id ? c.purchase_unit : '-'}
                  </td>
                  <td className="muted" style={{ fontSize: 13 }}>
                    {c.item_id ? `≈ ${Number((parseFloat(c.qty || '0') * c.ratio).toFixed(2)).toLocaleString('id-ID')} ${c.smallest_unit}` : '-'}
                  </td>
                  <td>
                     <Input type="text" value={c.note} onChange={e => updateCartNote(c.id, e.target.value)} placeholder="Catatan (Opsional)" style={{ height: 32, minWidth: 150 }} />
                  </td>
                  <td className="center">
                    <Button size="sm" onClick={() => removeCartItem(c.id)} title="Delete" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </Button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr><td colSpan={6} className="center muted" style={{ padding: 40 }}>Keranjang Anda kosong. Klik "+ Tambah Barang" untuk menambahkan barang.</td></tr>
              )}
            </tbody>
          </Table>


        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Kirim Permintaan Pembelian"
        message={`Apakah Anda yakin ingin mengirim permintaan ini dengan ${cart.length} barang?`}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        loading={submitting}
        confirmText="Ya, Kirim"
        cancelText="Batal"
      />
    </section>
  );
}

'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';

export default function CreateDirectPurchasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' as 'success'|'error'|'info' });

  const [form, setForm] = useState({
    receipt_number: '',
    notes: '',
  });

  const [lines, setLines] = useState([
    { item_id: '', brand_id: '', shop_name: '', qty: '', unit_price: '', unit_type: 'purchase' }
  ]);

  useEffect(() => {
    fetch('/api/items?active_only=true')
      .then(r => r.json())
      .then(d => {
        if (d.success) setItems(d.data || []);
      });
  }, []);

  const parentItems = items.filter(i => i.parent_id === null);

  const handleAddLine = () => {
    setLines([{ item_id: '', brand_id: '', shop_name: '', qty: '', unit_price: '', unit_type: 'purchase' }, ...lines]);
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleChangeLine = (index: number, field: string, value: string) => {
    const newLines = [...lines];
    (newLines[index] as any)[field] = value;
    if (field === 'item_id') {
      newLines[index].brand_id = ''; // reset brand if item changes
    }
    setLines(newLines);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      // Validate
      const validLines = lines.filter(l => l.item_id && l.shop_name && Number(l.qty) > 0 && Number(l.unit_price) >= 0);
      if (validLines.length === 0) {
        setToast({ open: true, message: 'Harap isi minimal 1 baris barang belanjaan dengan lengkap', type: 'error' });
        return;
      }

      let total_amount = 0;
      const payloadItems = validLines.map(l => {
        const pItem = items.find(i => String(i.id) === String(l.item_id));
        const bItem = l.brand_id ? items.find(i => String(i.id) === String(l.brand_id)) : null;
        
        const usedItem = bItem || pItem;
        const subtotal = Number(l.qty) * Number(l.unit_price);
        total_amount += subtotal;

        const isSmallest = l.unit_type === 'smallest';
        const conversion_ratio = usedItem?.conversion_ratio || 1;
        const smallest_qty = isSmallest ? Number(l.qty) : (Number(l.qty) * conversion_ratio);

        return {
          item_id: Number(l.item_id),
          brand_id: l.brand_id ? Number(l.brand_id) : null,
          shop_name: l.shop_name,
          qty: Number(l.qty),
          unit: isSmallest ? (usedItem?.smallest_unit || '') : (usedItem?.purchase_unit || ''),
          unit_price: Number(l.unit_price),
          subtotal,
          smallest_qty
        };
      });

      const res = await fetch('/api/direct-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_number: form.receipt_number,
          notes: form.notes,
          total_amount,
          items: payloadItems
        })
      });

      if (res.ok) {
        router.push('/direct-purchases');
      } else {
        const text = await res.text();
        setToast({ open: true, message: 'Gagal menyimpan: ' + text, type: 'error' });
      }
    } catch (e: any) {
      setToast({ open: true, message: 'Terjadi kesalahan sistem', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen">
      <div className="screen-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="screen-title" style={{ display: 'flex', alignItems: 'center' }}>
          <Button variant="outline" onClick={() => router.back()} style={{ marginRight: 16, padding: '8px' }}>
            <ArrowLeft size={16} />
          </Button>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Catat Belanja Pasar</h2>
        </div>
        <div className="screen-actions">
          <Button variant="primary" onClick={handleSubmit} disabled={loading} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Save size={16} /> {loading ? 'Menyimpan...' : 'Simpan Belanjaan'}
          </Button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label>No. Referensi / Nota *</label>
              <input 
                type="text" 
                className="input" 
                placeholder="Contoh: NOTA-123"
                value={form.receipt_number}
                onChange={e => setForm({ ...form, receipt_number: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ flex: '2 1 400px' }}>
              <label>Catatan Umum *</label>
              <input 
                type="text" 
                className="input" 
                placeholder="Contoh: Belanja bahan darurat di Pasar Pagi"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Daftar Barang Belanjaan</h3>
          </div>
          <Button variant="outline" onClick={handleAddLine} size="sm" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Plus size={16} /> Tambah Baris
          </Button>
        </div>
        <div className="card-body flush">
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Nama Barang</th>
                  <th>Merk *</th>
                  <th>Nama Toko</th>
                  <th style={{ width: 120 }}>Jumlah</th>
                  <th style={{ width: 160 }}>Harga Satuan</th>
                  <th style={{ width: 160 }} className="right">Subtotal</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const availableBrands = items.filter(i => i.parent_id !== null && String(i.parent_id) === String(line.item_id));
                  const selectedItem = items.find(i => String(i.id) === String(line.brand_id || line.item_id));
                  const unitLabel = selectedItem ? selectedItem.purchase_unit : '';
                  const subtotal = (Number(line.qty) || 0) * (Number(line.unit_price) || 0);

                  return (
                    <tr key={idx}>
                      <td>
                        <Select 
                          value={line.item_id}
                          onChange={val => handleChangeLine(idx, 'item_id', String(val))}
                          options={[
                            { value: '', label: 'Pilih Barang...' },
                            ...parentItems.map(i => ({ value: i.id, label: i.name }))
                          ]}
                          style={{ width: '100%' }}
                          searchable
                        />
                      </td>
                      <td>
                        <Select 
                          value={line.brand_id}
                          onChange={val => handleChangeLine(idx, 'brand_id', String(val))}
                          options={[
                            { value: '', label: availableBrands.length ? 'Pilih Merk *' : 'Tidak ada Merk' },
                            ...availableBrands.map(b => ({ value: b.id, label: b.name }))
                          ]}
                          disabled={!line.item_id || availableBrands.length === 0}
                          style={{ width: '100%' }}
                          searchable
                        />
                      </td>
                      <td>
                        <input 
                          type="text" 
                          className="input" 
                          placeholder="Toko A"
                          value={line.shop_name}
                          onChange={e => handleChangeLine(idx, 'shop_name', e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input 
                            type="number" 
                            className="input right" 
                            min="0"
                            value={line.qty}
                            onChange={e => handleChangeLine(idx, 'qty', e.target.value)}
                            style={{ width: 70 }}
                          />
                          {selectedItem ? (
                            <Select 
                              value={line.unit_type || 'purchase'}
                              onChange={val => handleChangeLine(idx, 'unit_type', String(val))}
                              options={
                                selectedItem.purchase_unit !== selectedItem.smallest_unit ? [
                                  { value: 'purchase', label: selectedItem.purchase_unit },
                                  { value: 'smallest', label: selectedItem.smallest_unit }
                                ] : [
                                  { value: 'purchase', label: selectedItem.purchase_unit }
                                ]
                              }
                              style={{ width: 90 }}
                            />
                          ) : (
                            <span className="muted" style={{ fontSize: 12 }}>-</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="muted">Rp</span>
                          <input 
                            type="number" 
                            className="input right" 
                            min="0"
                            value={line.unit_price}
                            onChange={e => handleChangeLine(idx, 'unit_price', e.target.value)}
                            style={{ flex: 1 }}
                          />
                        </div>
                      </td>
                      <td className="right font-bold">
                        Rp {subtotal.toLocaleString('id-ID')}
                      </td>
                      <td className="center">
                        {lines.length > 1 && (
                          <button 
                            className="btn-icon danger" 
                            onClick={() => handleRemoveLine(idx)}
                            title="Hapus baris"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Toast isOpen={toast.open} type={toast.type} message={toast.message} onClose={() => setToast({ ...toast, open: false })} />
    </div>
  );
}

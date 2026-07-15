'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Toast } from '@/components/ui/Toast';

interface POItem {
  id: number;
  item_id: number;
  description: string;
  qty: number;
  unit_price: number;
  total_received?: number;
  purchase_unit?: string;
}

interface PO {
  id: number;
  po_number: string;
  vendor_name: string;
  status: string;
  items: POItem[];
}

export default function ReceiptClient({ poId }: { poId: number }) {
  const router = useRouter();
  const [po, setPo] = useState<PO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [receivedQtys, setReceivedQtys] = useState<Record<number, string>>({});
  const [deliveryNote, setDeliveryNote] = useState('');
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as 'success' | 'error' });

  useEffect(() => {
    fetch(`/api/purchase-orders/${poId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPo(d.data);
          const initialQtys: Record<number, string> = {};
          d.data.items.forEach((item: any) => {
            if (item.line_type === 'PRODUK') {
              initialQtys[item.id] = '';
            }
          });
          setReceivedQtys(initialQtys);
        } else {
          setError(d.message);
        }
      })
      .finally(() => setLoading(false));
  }, [poId]);

  const handleQtyChange = (id: number, value: string) => {
    // Allow digits, single comma or dot for decimals
    if (value === '' || /^[0-9]+([.,][0-9]*)?$/.test(value)) {
      // We store the raw string the user types to allow '4.' or '4,5' naturally
      setReceivedQtys(prev => ({ ...prev, [id]: value }));
    }
  };

  async function handleValidate() {
    if (!po) return;
    
    let hasShortfall = false;
    let hasExcess = false;
    let totalReceived = 0;
    const itemsPayload = [];
    
    for (const item of po.items) {
      if (item.item_id) {
        const rawStr = receivedQtys[item.id] || '';
        // Convert comma to dot for parsing
        const rQty = Number(rawStr.replace(/,/g, '.')) || 0;
        
        totalReceived += rQty;
        if (rQty < item.qty) hasShortfall = true;
        if (rQty > item.qty) hasExcess = true;
        
        if (rQty > 0) {
          itemsPayload.push({
            purchase_order_item_id: item.id,
            item_id: item.item_id,
            qty_received: rQty
          });
        }
      }
    }
    
    if (totalReceived === 0) {
      setError('Belum ada barang yang diterima. Isi kuantitas minimal 1.');
      return;
    }
    
    if (hasExcess) {
      const confirmExcess = confirm('Terdapat barang yang melebihi jumlah pesanan. Lanjutkan?');
      if (!confirmExcess) return;
    }

    if (hasShortfall) {
      const confirmBackorder = confirm('Ada pesanan yang belum datang sepenuhnya (kurang). Apakah Anda ingin membuat Backorder untuk sisanya?\n\n- OK: Buat Backorder (Status: DITERIMA SEBAGIAN)\n- Cancel: Anggap selesai (Status: SELESAI)');
      // Backend handles automatically
    }
    
    setSaving(true);
    setError('');
    
    try {
      const res = await fetch('/api/warehouse/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_order_id: po.id,
          vendor_delivery_note: deliveryNote,
          items: itemsPayload
        })
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message);
      
      setToast({ isOpen: true, message: 'Penerimaan barang berhasil!', type: 'success' });
      setTimeout(() => {
        router.push('/warehouse');
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Memuat data PO...</div>;
  if (error && !po) return <div style={{ padding: 40, color: 'red' }}>Error: {error}</div>;
  if (!po) return null;

  return (
    <section className="screen">
      <Toast 
        isOpen={toast.isOpen} 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ ...toast, isOpen: false })} 
      />
      <div className="card">
        <div className="card-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, alignSelf: 'flex-start', padding: 0, fontSize: 14 }}>&larr; Kembali</button>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>Penerimaan: {po.po_number}</h3>
          </div>
          <button 
            className="btn btn-primary"
            onClick={handleValidate}
            disabled={saving}
            style={{ fontWeight: 600, padding: '8px 24px' }}
          >
            {saving ? 'Menyimpan...' : 'Validate Receipt'}
          </button>
        </div>
        
        <div className="card-body flush" style={{ padding: 24 }}>
          {error && <div className="alert-banner alert-danger" style={{ marginBottom: 24 }}>{error}</div>}
          
          <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Vendor</label>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{po.vendor_name}</div>
            </div>
            <div style={{ flex: 1, maxWidth: 400 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>No. Surat Jalan Vendor</label>
              <input 
                className="input"
                type="text" 
                value={deliveryNote}
                onChange={e => setDeliveryNote(e.target.value)}
                placeholder="e.g. SJ-12345"
                style={{ width: '100%' }}
              />
            </div>
          </div>
          
          <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', color: '#1e293b' }}>Daftar Barang</h4>
          
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px', fontSize: 13, color: '#64748b', textAlign: 'left' }}>PRODUK</th>
                  <th style={{ padding: '12px', fontSize: 13, color: '#64748b', textAlign: 'right', width: 150 }}>DIPESAN</th>
                  <th style={{ padding: '12px', fontSize: 13, color: '#64748b', textAlign: 'right', width: 180 }}>DITERIMA</th>
                </tr>
              </thead>
              <tbody>
                {po.items.filter(i => i.item_id).map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#334155' }}>{item.description}</td>
                    <td className="right" style={{ padding: '12px', color: '#64748b', fontWeight: 500 }}>
                      {Number(item.qty).toLocaleString('id-ID')} <span className="muted" style={{ fontSize: 11 }}>{item.purchase_unit || 'pcs'}</span>
                    </td>
                    <td className="right" style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <input 
                          type="text"
                          className="input right num font-bold"
                          placeholder="0"
                          value={receivedQtys[item.id] !== undefined ? receivedQtys[item.id] : ''}
                          onChange={e => handleQtyChange(item.id, e.target.value)}
                          onFocus={e => e.target.select()}
                          style={{ width: '80px', padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1' }}
                        />
                        <span className="muted" style={{ fontSize: 12, minWidth: 32, textAlign: 'left' }}>{item.purchase_unit || 'pcs'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

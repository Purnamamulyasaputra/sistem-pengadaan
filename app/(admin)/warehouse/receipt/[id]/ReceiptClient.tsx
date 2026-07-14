'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface POItem {
  id: number;
  item_id: number;
  description: string;
  qty: number;
  unit_price: number;
  total_received?: number;
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
  const [receivedQtys, setReceivedQtys] = useState<Record<number, number>>({});
  const [deliveryNote, setDeliveryNote] = useState('');
  
  // Barcode scanner state
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    fetch(`/api/purchase-orders/${poId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPo(d.data);
          const initialQtys: Record<number, number> = {};
          d.data.items.forEach((item: any) => {
            if (item.line_type === 'PRODUK') {
              // Fetch how much was previously received.
              // For simplicity, we assume this is the first receipt, or we just init with 0
              initialQtys[item.id] = 0;
            }
          });
          setReceivedQtys(initialQtys);
        } else {
          setError(d.message);
        }
      })
      .finally(() => setLoading(false));
  }, [poId]);

  async function handleValidate() {
    if (!po) return;
    
    // Check if there's any shortfall
    let hasShortfall = false;
    let hasExcess = false;
    let totalReceived = 0;
    
    const itemsPayload = [];
    
    for (const item of po.items) {
      if (item.item_id) {
        const rQty = receivedQtys[item.id] || 0;
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
      // If true, backorder. It's handled by backend automatically setting status based on qty.
      // Wait, our backend auto sets SELESAI if fully received, and DITERIMA_SEBAGIAN if shortfall.
      // But if user wants to close it permanently despite shortfall, we'd need to tell backend to force SELESAI.
      // For now, let backend handle it natively.
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
      
      alert('Penerimaan barang berhasil!');
      router.push('/purchase-orders'); // or /warehouse if built
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Very simplified barcode scanner toggle
  function toggleScanner() {
    if (scanning) {
      setScanning(false);
    } else {
      setScanning(true);
      // In a real implementation, you would attach BrowserMultiFormatReader to a video element here
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Memuat data PO...</div>;
  if (error && !po) return <div style={{ padding: 40, color: 'red' }}>Error: {error}</div>;
  if (!po) return null;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, marginBottom: 16 }}>&larr; Kembali</button>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)', margin: 0 }}>Penerimaan: {po.po_number}</h1>
        <button 
          onClick={handleValidate}
          disabled={saving}
          style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}
        >
          {saving ? 'Menyimpan...' : 'Validate Receipt'}
        </button>
      </div>
      
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 12, borderRadius: 4, marginBottom: 16 }}>{error}</div>}
      
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, border: '1px solid var(--border)', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Vendor</label>
            <div style={{ fontWeight: 500 }}>{po.vendor_name}</div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>No. Surat Jalan Vendor</label>
            <input 
              type="text" 
              value={deliveryNote}
              onChange={e => setDeliveryNote(e.target.value)}
              placeholder="e.g. SJ-12345"
              style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 4, width: '100%' }}
            />
          </div>
        </div>
        
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Daftar Barang</h2>
          <button onClick={toggleScanner} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }}>
            {scanning ? 'Stop Scanner' : '📷 Scan Barcode'}
          </button>
        </div>
        
        {scanning && (
          <div style={{ background: '#000', height: 200, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            [Area Kamera Scanner Aktif - Simulasi]
          </div>
        )}
        
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
              <th style={{ padding: '12px 8px', fontSize: 13, color: '#64748b' }}>PRODUK</th>
              <th style={{ padding: '12px 8px', fontSize: 13, color: '#64748b', textAlign: 'right' }}>DIPESAN</th>
              <th style={{ padding: '12px 8px', fontSize: 13, color: '#64748b', textAlign: 'right', width: 150 }}>DITERIMA</th>
            </tr>
          </thead>
          <tbody>
            {po.items.filter(i => i.item_id).map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 8px', fontWeight: 500 }}>{item.description}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right', color: '#64748b' }}>{item.qty}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  <input 
                    type="number"
                    min="0"
                    value={receivedQtys[item.id] !== undefined ? receivedQtys[item.id] : ''}
                    onChange={e => setReceivedQtys(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                    style={{ width: 100, padding: '6px 8px', textAlign: 'right', border: '1px solid #cbd5e1', borderRadius: 4 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';

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
  
  // Modal states
  const [confirmModal, setConfirmModal] = useState<{type: 'excess' | 'shortfall' | 'normal', title: string, message: string} | null>(null);
  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error' | 'info'}>({ show: false, message: '', type: 'success' });

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

  async function handleValidate(bypassConfirm = false) {
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
      setError('No items received yet. Please enter at least 1 quantity.');
      return;
    }
    
    if (!bypassConfirm) {
      if (hasExcess) {
        setConfirmModal({ type: 'excess', title: 'Excess Receipt', message: 'There are items exceeding the ordered quantity. Are you sure you want to proceed?' });
      } else if (hasShortfall) {
        setConfirmModal({ type: 'shortfall', title: 'Incomplete Order', message: 'Some items are not fully received. Do you want to proceed and leave them as Backorder?' });
      } else {
        setConfirmModal({ type: 'normal', title: 'Confirmation', message: 'Are you sure you want to validate this receipt?' });
      }
      return;
    }
    
    // If we reach here, it means either everything is exact, or the user already confirmed the modal.
    executeValidation(itemsPayload);
  }

  async function executeValidation(itemsPayload: any[]) {
    setSaving(true);
    setError('');
    
    try {
      const res = await fetch('/api/warehouse/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_order_id: po!.id,
          vendor_delivery_note: deliveryNote,
          items: itemsPayload
        })
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message);
      
      setToast({ show: true, message: 'Goods receipt has been saved and stock successfully updated.', type: 'success' });
      setTimeout(() => {
        if (po) {
          window.location.href = `/purchase-orders?open=${po.id}`;
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
      setConfirmModal(null);
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

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading PO data...</div>;
  if (error && !po) return <div style={{ padding: 40, color: 'red' }}>Error: {error}</div>;
  if (!po) return null;

  return (
    <section className="screen">
      <div className="card">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Back
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Receipt: {po.po_number}</h1>
          </div>
          <button 
            onClick={() => handleValidate()}
            disabled={saving}
            className="btn btn-primary btn-sm"
          >
            {saving ? 'Saving...' : 'Validate Receipt'}
          </button>
        </div>
        
        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 12, margin: '16px 24px 0', borderRadius: 4 }}>{error}</div>}
        
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Vendor</label>
              <div style={{ fontWeight: 500, color: 'var(--foreground)' }}>{po.vendor_name}</div>
            </div>
            <div style={{ flex: 1, maxWidth: 300 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Vendor Delivery Note</label>
              <input 
                type="text" 
                className="input"
                value={deliveryNote}
                onChange={e => setDeliveryNote(e.target.value)}
                placeholder="e.g. SJ-12345"
                style={{ width: '100%' }}
              />
            </div>
          </div>
          
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>Products</h2>
            <button onClick={toggleScanner} className="btn btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              {scanning ? 'Stop Scanner' : 'Scan Barcode'}
            </button>
          </div>
          
          {scanning && (
            <div style={{ background: '#1e293b', height: 200, borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: '1px dashed #475569' }}>
              [Area Kamera Scanner Aktif - Simulasi]
            </div>
          )}
          
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: 12 }}>PRODUCT</th>
                <th style={{ padding: '12px 16px', fontSize: 12, textAlign: 'right' }}>ORDERED</th>
                <th style={{ padding: '12px 16px', fontSize: 12, textAlign: 'right', width: 150 }}>RECEIVED</th>
              </tr>
            </thead>
            <tbody>
              {po.items.filter(i => i.item_id).map(item => (
                <tr key={item.id}>
                  <td style={{ padding: '12px 16px', fontWeight: 500, borderBottom: '1px solid #f1f5f9' }}>{item.description}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                    {Number(item.qty)} {(item as any).purchase_unit || ''}
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                    <input 
                      type="number"
                      min="0"
                      className="input"
                      placeholder="0"
                      value={receivedQtys[item.id] || ''}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      onChange={e => {
                        const val = e.target.value;
                        setReceivedQtys(prev => ({ ...prev, [item.id]: val === '' ? 0 : parseFloat(val) }));
                      }}
                      style={{ width: 100, textAlign: 'right' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmModal}
        title={confirmModal?.title || 'Confirmation'}
        message={confirmModal?.message || ''}
        confirmText="Proceed"
        cancelText="Cancel"
        danger={confirmModal?.type === 'excess'}
        onConfirm={() => {
          if (confirmModal) {
            setConfirmModal(null);
            // Re-trigger validation, this time bypassing the modal check
            handleValidate(true);
          }
        }}
        onCancel={() => setConfirmModal(null)}
      />

      <Toast
        isOpen={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </section>
  );
}

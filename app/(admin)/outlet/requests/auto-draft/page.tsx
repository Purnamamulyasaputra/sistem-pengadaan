'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { ChevronLeft, Send } from 'lucide-react';
import { Table } from '@/components/ui/Table';

type DraftRow = {
  item_id: number;
  item_name: string;
  category_name: string;
  current_balance: number;
  purchase_unit: string;
  smallest_unit: string;
  minimum_threshold: number;
  conversion_ratio: number;
  
  // UI States
  effective_balance: number;
  incoming_balance: number;
  request_qty: number;
  selected: boolean;
};

export default function AutoRestockDraftPage() {
  const router = useRouter();
  const [data, setData] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' as 'success'|'error'|'info' });

  useEffect(() => {
    fetch('/api/outlet/inventory')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          // Filter only low stock items taking into account incoming POs
          const lowStockItems = json.data
            .filter((d: any) => {
              if (d.minimum_threshold === null) return false;
              const effectiveBalance = Number(d.current_balance || 0) + Number(d.incoming_balance || 0);
              return effectiveBalance <= d.minimum_threshold;
            })
            .map((d: any) => {
              const effectiveBalance = Number(d.current_balance || 0) + Number(d.incoming_balance || 0);
              let shortage = d.minimum_threshold - effectiveBalance;
              // If it's exactly at threshold (shortage = 0), we suggest ordering the min threshold amount again
              if (shortage <= 0) shortage = d.minimum_threshold;

              return {
                ...d,
                incoming_balance: Number(d.incoming_balance || 0),
                effective_balance: effectiveBalance,
                request_qty: shortage,
                // Uncheck by default if item already has an active incoming PO
                selected: Number(d.incoming_balance || 0) === 0
              };
            });
          setData(lowStockItems);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const toggleSelect = (id: number) => {
    setData(prev => prev.map(d => d.item_id === id ? { ...d, selected: !d.selected } : d));
  };

  const handleToggleAll = (checked: boolean) => {
    setData(prev => prev.map(r => ({ ...r, selected: checked })));
  };

  const handleQtyChange = (id: number, val: string) => {
    const num = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
    setData(prev => prev.map(d => d.item_id === id ? { ...d, request_qty: num } : d));
  };

  const handleSubmit = async () => {
    const selectedItems = data.filter(d => d.selected && d.request_qty > 0);
    if (selectedItems.length === 0) {
      setToast({ open: true, message: 'Pilih minimal 1 barang untuk di-request!', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        items: selectedItems.map(item => ({
          item_id: item.item_id,
          item_name: item.item_name,
          category_name: item.category_name,
          purchase_unit: item.purchase_unit,
          smallest_unit: item.smallest_unit,
          qty_request: item.request_qty / (item.conversion_ratio || 1)
        }))
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const resJson = await res.json();
      if (res.ok) {
        setToast({ open: true, message: 'Restock Draft berhasil dikirim ke Pusat!', type: 'success' });
        setTimeout(() => {
          router.push('/outlet/requests');
        }, 1500);
      } else {
        throw new Error(resJson.error || 'Gagal mengirim draft');
      }
    } catch (e: any) {
      setToast({ open: true, message: e.message, type: 'error' });
      setSubmitting(false);
    }
  };

  const allSelected = data.length > 0 && data.every(d => d.selected);

  return (
    <section className="screen" style={{ paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn" onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
          <ChevronLeft size={18} /> Back
        </button>
        <div>
          <h2 style={{ margin: 0 }}>Restock Draft</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Sistem otomatis menghitung <strong>(Stok Fisik + Pesanan dalam Perjalanan)</strong>. Barang yang tampil di sini adalah yang total stoknya di bawah batas Minimum Stok.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body flush" style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }} className="muted">
              Mengecek status stok...
            </div>
          ) : data.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }} className="muted">
              Tidak ada barang yang Low Stock saat ini. Gudang aman!
            </div>
          ) : (
            <Table>
              <thead>
                <tr style={{ fontSize: 12 }}>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input type="checkbox" style={{ width: 14, height: 14, accentColor: '#016e3f', cursor: 'pointer' }} checked={allSelected} onChange={e => handleToggleAll(e.target.checked)} />
                  </th>
                  <th>Bahan Baku (Resep)</th>
                  <th className="right">Min Stok</th>
                  <th className="right">Stok Fisik</th>
                  <th className="right" style={{ width: 140 }}>Estimasi Request</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: 13 }}>
                {data.map(row => (
                  <tr key={row.item_id} style={{ opacity: row.selected ? 1 : 0.6 }}>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={row.selected} 
                        onChange={() => toggleSelect(row.item_id)} 
                        style={{ width: 14, height: 14, accentColor: '#016e3f', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      <div>{row.item_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{row.category_name}</div>
                    </td>
                    <td className="right muted">
                      {row.minimum_threshold} <span style={{ fontSize: 11 }}>{row.smallest_unit}</span>
                    </td>
                    <td className="right" style={{ color: 'var(--red)' }}>
                      {row.current_balance} <span style={{ fontSize: 11, color: 'var(--muted)' }}>{row.smallest_unit}</span>
                      {row.incoming_balance > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 2, fontWeight: 600 }}>
                          + {row.incoming_balance} {row.smallest_unit} (Sedang Diproses)
                        </div>
                      )}
                    </td>
                    <td className="right">
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'flex-end',
                        background: row.selected ? '#fff' : '#f8fafc',
                        border: `1px solid ${row.selected ? '#94a3b8' : 'transparent'}`,
                        borderRadius: 6,
                        padding: '2px 8px',
                        width: 120,
                        marginLeft: 'auto',
                        transition: 'all 0.2s'
                      }}>
                        <input
                          type="text"
                          value={row.request_qty}
                          onChange={e => handleQtyChange(row.item_id, e.target.value)}
                          onWheel={e => (e.target as HTMLInputElement).blur()}
                          disabled={!row.selected}
                          style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            textAlign: 'right',
                            fontWeight: 700,
                            fontSize: 13,
                            background: 'transparent',
                            color: row.selected ? 'var(--foreground)' : 'var(--muted)'
                          }}
                        />
                        <span style={{ fontSize: 11, color: row.selected ? 'var(--muted)' : '#cbd5e1', marginLeft: 6, fontWeight: 600 }}>
                          {row.smallest_unit}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      {/* Floating Save Button */}
      {data.length > 0 && !loading && (
        <div style={{ position: 'fixed', bottom: 0, left: 240, right: 0, background: '#fff', borderTop: '1px solid var(--border)', padding: '16px 32px', display: 'flex', justifyContent: 'flex-end', zIndex: 100, boxShadow: '0 -4px 6px -1px rgb(0 0 0 / 0.05)' }}>
          <button 
            className="btn btn-primary" 
            style={{ padding: '10px 24px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }} 
            onClick={handleSubmit} 
            disabled={submitting || data.filter(d => d.selected).length === 0}
          >
            <Send size={18} />
            {submitting ? 'Mengirim...' : 'Kirim Request ke Pusat'}
          </button>
        </div>
      )}

      {toast.open && (
        <Toast
          isOpen={toast.open}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, open: false })}
        />
      )}
    </section>
  );
}

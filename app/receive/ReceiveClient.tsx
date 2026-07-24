'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table } from '@/components/ui/Table';

export default function PublicReceiveClient() {
  const searchParams = useSearchParams();
  const code = searchParams.get('kode') || '';

  const [dn, setDn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [recipientName, setRecipientName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!code) {
      setError('Kode Surat Jalan tidak valid.');
      setLoading(false);
      return;
    }
    fetch(`/api/public/receive-delivery?kode=${encodeURIComponent(code)}`)
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.message);
        setDn(data.dn);
        setItems(data.dn.items.map((item: any) => {
          const ratio = Number(item.conversion_ratio) || 1;
          return {
            order_item_id: item.order_item_id,
            item_name: item.item_name,
            purchase_unit: item.purchase_unit,
            ratio: ratio,
            qty_shipped_display: item.qty_shipped / ratio,
            qty_received_display: item.qty_shipped / ratio,
            receive_notes: '',
          };
        }));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [code]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleQtyChange = (orderItemId: number, value: number) => {
    setItems(prev => prev.map(i => i.order_item_id === orderItemId ? { ...i, qty_received_display: value } : i));
  };

  const handleNotesChange = (orderItemId: number, value: string) => {
    setItems(prev => prev.map(i => i.order_item_id === orderItemId ? { ...i, receive_notes: value } : i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!recipientName.trim()) { setSubmitError('Nama penerima wajib diisi.'); return; }
    if (!photo) { setSubmitError('Foto bukti penerimaan wajib diunggah.'); return; }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('recipient_name', recipientName);
      formData.append('photo', photo);
      formData.append('items', JSON.stringify(items.map(i => ({
        order_item_id: i.order_item_id,
        qty_received: i.qty_received_display * i.ratio,
        receive_notes: i.receive_notes,
      }))));

      const res = await fetch(`/api/public/receive-delivery?kode=${encodeURIComponent(code)}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Gagal memproses penerimaan.');
      setSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render States ----
  const headerStyle: React.CSSProperties = {
    background: '#016e3f',
    padding: '24px',
    color: '#fff',
    textAlign: 'center',
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Albert Sans, sans-serif' }}>
      <p style={{ color: '#64748b' }}>Memuat data Surat Jalan...</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Albert Sans, sans-serif', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', maxWidth: 400, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h3 style={{ margin: '0 0 8px' }}>Tidak Ditemukan</h3>
        <p style={{ color: '#64748b', margin: 0 }}>{error}</p>
      </div>
    </div>
  );

  if (success) return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Albert Sans, sans-serif', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', maxWidth: 400, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style={{ margin: '0 0 12px', color: '#166534' }}>Penerimaan Berhasil!</h2>
        <p style={{ color: '#64748b', margin: '0 0 8px' }}>Terima kasih telah mengkonfirmasi penerimaan barang.</p>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Anda boleh menutup halaman ini.</p>
      </div>
    </div>
  );

  if (dn && dn.status !== 'DIKIRIM' && dn.status !== 'DRAFT') return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Albert Sans, sans-serif', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', maxWidth: 400, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 8px' }}>Tidak Dapat Diproses</h3>
        <p style={{ color: '#64748b', margin: 0 }}>Surat Jalan ini sudah berstatus <strong>{dn.status}</strong> dan tidak perlu dikonfirmasi lagi.</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'Albert Sans, sans-serif', paddingBottom: 40 }}>
      <div style={{ maxWidth: 600, margin: '0 auto', background: '#fff', borderRadius: '0 0 12px 12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={headerStyle}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Konfirmasi Penerimaan</h1>
          <p style={{ margin: '6px 0 0', opacity: 0.85, fontSize: 14 }}>{dn?.delivery_note_number}</p>
        </div>

        {/* Info Surat Jalan */}
        <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
          <div>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 2 }}>Tujuan</div>
            <div style={{ fontWeight: 600 }}>{dn?.outlet_name}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 2 }}>Tanggal Kirim</div>
            <div style={{ fontWeight: 600 }}>{dn ? new Date(dn.delivery_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {submitError && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
              {submitError}
            </div>
          )}

          {/* Nama Penerima */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 15 }}>
              Nama Penerima <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <Input
              type="text"
              placeholder="Masukkan nama Anda..."
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          {/* Foto Bukti */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 15 }}>
              Foto Bukti Penerimaan <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <label htmlFor="photo-input" style={{ display: 'block', border: '2px dashed #cbd5e1', borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', background: photoPreview ? '#f0fdf4' : '#f8fafc', transition: 'all 0.2s' }}>
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px', display: 'block' }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <p style={{ color: '#64748b', margin: '0 0 4px', fontWeight: 600 }}>Ketuk untuk ambil foto</p>
                  <p style={{ color: '#94a3b8', margin: 0, fontSize: 13 }}>Gunakan kamera HP Anda</p>
                </>
              )}
            </label>
            <input id="photo-input" type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} style={{ display: 'none' }} />
          </div>

          {/* Daftar Barang */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 12, fontSize: 16, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>Daftar Barang</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map(item => (
                <div key={item.order_item_id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, background: '#f8fafc' }}>
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>{item.item_name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Jml Dikirim</div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{item.qty_shipped_display} <span style={{ fontSize: 13, color: '#64748b' }}>{item.purchase_unit}</span></div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Jml Diterima <span style={{ color: '#dc2626' }}>*</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.qty_received_display}
                          onChange={e => handleQtyChange(item.order_item_id, parseFloat(e.target.value) || 0)}
                          disabled={submitting}
                          required
                          style={{ textAlign: 'right', fontWeight: 600, flex: 1 }}
                        />
                        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{item.purchase_unit}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Catatan (opsional)</div>
                    <Input
                      type="text"
                      placeholder="Contoh: 2 pcs penyok, dll..."
                      value={item.receive_notes}
                      onChange={e => handleNotesChange(item.order_item_id, e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={submitting}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', fontSize: 16, padding: '14px 24px' }}
          >
            {submitting ? 'Menyimpan...' : '✓ Terima Barang Sekarang'}
          </Button>
        </form>
      </div>
    </div>
  );
}

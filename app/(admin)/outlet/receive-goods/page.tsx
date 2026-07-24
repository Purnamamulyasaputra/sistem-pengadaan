'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';

interface DeliveryNote {
  id: number; delivery_note_number: string; status: string;
  order_id: number; delivery_date: string; driver_name: string;
  proof_image_url?: string;
}

function getDisplayFormat(qty: number, unit: string) {
  const u = (unit || '').trim().toLowerCase();
  if (u === 'gr' && qty >= 1000) return { unit: 'kg', mult: 1000, value: qty / 1000 };
  if (u === 'ml' && qty >= 1000) return { unit: 'Liter', mult: 1000, value: qty / 1000 };
  return { unit, mult: 1, value: qty };
}

export default function ReceiveGoodsPage() {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanModal, setScanModal] = useState<DeliveryNote | null>(null);

  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, message: '', type: 'info' });
  const [itemsList, setItemsList] = useState<any[]>([]);

  // Row states
  const [qtys, setQtys] = useState<Record<number, number | ''>>({});
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [discNotes, setDiscNotes] = useState<Record<number, string>>({});

  // Global barcode scanner
  const [globalBarcode, setGlobalBarcode] = useState('');
  const [scanning, setScanning] = useState(false);

  // Finalization states
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    setProofImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/delivery-notes`);
    const data = await res.json();
    // Show DIKIRIM and DITERIMA, hide DRAFT and CANCELED
    const allowed = (data.data ?? []).filter((d: any) => d.status === 'DIKIRIM' || d.status === 'DITERIMA');
    setDeliveryNotes(allowed);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  async function openScan(dn: DeliveryNote) {
    setScanModal(dn);
    setToast({ ...toast, isOpen: false });
    setProofImage(null);
    setPreviewUrl(dn.proof_image_url || null);
    setGlobalBarcode('');
    setQtys({});
    setReasons({});
    setDiscNotes({});

    const res = await fetch(`/api/delivery-notes/${dn.id}`);
    const data = await res.json();
    setItemsList(data.data?.items ?? []);
  }

  async function handleGlobalScan(e: React.FormEvent) {
    e.preventDefault();
    if (!scanModal || !globalBarcode.trim()) return;

    const barcode = globalBarcode.trim();

    if (barcode !== scanModal.delivery_note_number) {
      setToast({ isOpen: true, message: `Harap scan Kode Tracking dari Surat Jalan (${scanModal.delivery_note_number}) untuk memvalidasi seluruh pengiriman.`, type: 'error' });
      setGlobalBarcode('');
      return;
    }

    // Validate inputs
    for (const item of itemsList) {
      if (item.scanned_in_at) continue;

      const inputQty = qtys[item.id];
      if (inputQty === undefined || inputQty === '' || inputQty < 0) {
        setToast({ isOpen: true, message: `Harap masukkan Kuantitas Aktual untuk ${item.item_name}.`, type: 'error' });
        return;
      }

      const shippedFmt = getDisplayFormat(Number(item.qty_shipped), item.smallest_unit);
      const actualQtyReceivedBase = Number(inputQty) * shippedFmt.mult;
      const isDiscrepancy = actualQtyReceivedBase !== Number(item.qty_shipped);
      const notesStr = discNotes[item.id] || '';

      if (isDiscrepancy && !notesStr.trim()) {
        setToast({ isOpen: true, message: `Alasan selisih wajib diisi untuk ${item.item_name}.`, type: 'error' });
        return;
      }
    }

    setScanning(true);
    setToast({ ...toast, isOpen: false });
    try {
      // Process all items
      for (const item of itemsList) {
        if (item.scanned_in_at) continue;

        const inputQty = qtys[item.id];
        const shippedFmt = getDisplayFormat(Number(item.qty_shipped), item.smallest_unit);
        const actualQtyReceivedBase = Number(inputQty) * shippedFmt.mult;
        const isDiscrepancy = actualQtyReceivedBase !== Number(item.qty_shipped);
        const notesStr = discNotes[item.id] || '';

        const res = await fetch(`/api/delivery-notes/${item.id}/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            delivery_note_item_id: item.id,
            item_id: item.item_id,
            barcode_scanned: item.unique_barcode || item.barcode || scanModal.delivery_note_number,
            scan_type: 'IN',
            device_info: 'Web Dashboard Outlet',
            qty_received: actualQtyReceivedBase,
            discrepancy_reason: isDiscrepancy ? notesStr.trim() : undefined,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(`Failed on ${item.item_name}: ${data.message}`);
        }
      }

      setToast({ isOpen: true, message: `Semua barang terverifikasi! Menyelesaikan Penerimaan...`, type: 'info' });
      setGlobalBarcode('');

      await doFinalize(scanModal.id, proofImage);
    } catch (e: any) {
      setToast({ isOpen: true, message: e.message, type: 'error' });
    } finally {
      setScanning(false);
    }
  }

  async function doFinalize(dnId: number, photo: File | null) {
    if (!photo) {
      setToast({ isOpen: true, message: 'Foto bukti pengiriman wajib diunggah.', type: 'error' });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', photo);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        setToast({ isOpen: true, message: `Error mengunggah foto: ${uploadData.message}`, type: 'error' });
        return;
      }
      const confirmRes = await fetch(`/api/delivery-notes/${dnId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof_image_url: uploadData.url }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmData.success) {
        setToast({ isOpen: true, message: `Error menyelesaikan: ${confirmData.message}`, type: 'error' });
        return;
      }
      setScanModal(null);
      setToast({ isOpen: true, message: 'Surat Jalan diterima dan diselesaikan!', type: 'success' });
      fetchNotes();
    } catch (e: any) {
      setToast({ isOpen: true, message: e.message, type: 'error' });
    } finally {
      setUploading(false);
    }
  }

  const allScannedIn = itemsList.length > 0 && itemsList.every(i => i.scanned_in_at);

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Terima Barang (Scan IN)</h3>
          </div>
        </div>

        <div className="card-body flush">
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Memuat Surat Jalan...</div> : deliveryNotes.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 3h15v13H1z M16 8h4l3 3v5h-7V8z" /></svg>
              <h4>Belum ada pengiriman</h4>
              <p>Belum ada Surat Jalan dengan status DIKIRIM untuk outlet Anda</p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>No. Surat Jalan</th>
                  <th>No. Ref PO</th>
                  <th>Tanggal Kirim</th>
                  <th>Sopir</th>
                  <th className="center">Status</th>
                  <th className="right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {deliveryNotes.map(dn => (
                  <tr key={dn.id}>
                    <td className="font-mono text-primary font-bold">{dn.delivery_note_number}</td>
                    <td className="font-mono font-bold">
                      PO-{new Date(dn.delivery_date).getFullYear()}-{String(dn.order_id).padStart(5, '0')}
                    </td>
                    <td>{new Date(dn.delivery_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="muted">{dn.driver_name || '-'}</td>
                    <td className="center">
                      <Badge variant={dn.status === 'DITERIMA' ? 'green' : 'amber'}>
                        {dn.status === 'DITERIMA' ? 'Diterima' : dn.status === 'DIKIRIM' ? 'Dikirim' : dn.status}
                      </Badge>
                    </td>
                    <td className="right">
                      <Button variant={dn.status === 'DITERIMA' ? 'outline' : 'primary'} size="sm" onClick={() => openScan(dn)}>
                        {dn.status === 'DITERIMA' ? 'Lihat Bukti' : 'Verifikasi Barang'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      <Modal isOpen={!!scanModal} onClose={() => setScanModal(null)} title={`Terima Barang - ${scanModal?.delivery_note_number}`} maxWidth={900}>
        <div className="modal-body" style={{ padding: '16px 20px' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h5 style={{ margin: 0, color: 'var(--primary)', fontSize: 16 }}>Verifikasi Barang</h5>
            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24, overflowX: 'auto' }}>
            <Table>
              <thead><tr><th>Data Barang</th><th className="center">Jml Dikirim</th><th>Jml Aktual Diterima</th><th>Selisih (Jika Ada)</th><th className="center">Status</th></tr></thead>
              <tbody>
                {itemsList.map(item => {
                  const shippedFmt = getDisplayFormat(Number(item.qty_shipped), item.smallest_unit);
                  const isScanned = !!item.scanned_in_at;

                  if (isScanned) {
                    const received = item.qty_received != null ? getDisplayFormat(Number(item.qty_received), item.smallest_unit) : null;
                    return (
                      <tr key={item.id}>
                        <td className="font-bold">
                          {item.item_name}
                        </td>
                        <td className="center num">{shippedFmt.value.toLocaleString('en-US', { maximumFractionDigits: 3 })} {shippedFmt.unit}</td>
                        <td className="center num font-bold" style={{ color: item.qty_received != null && Number(item.qty_received) !== Number(item.qty_shipped) ? 'var(--danger)' : 'inherit' }}>
                          {received != null ? `${received.value.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${received.unit}` : '-'}
                        </td>
                        <td>
                          {item.discrepancy_reason ? (
                            <div style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.3 }}>
                              {item.discrepancy_reason}
                            </div>
                          ) : (
                            <span className="muted" style={{ fontSize: 12 }}>-</span>
                          )}
                        </td>
                        <td className="center">
                          <Badge variant="green">✓ Diterima</Badge>
                        </td>
                      </tr>
                    );
                  }

                  const inputQty = qtys[item.id] !== undefined ? qtys[item.id] : '';
                  const isDiscrepancy = inputQty !== '' && Number(inputQty) !== shippedFmt.value;

                  return (
                    <tr key={item.id}>
                      <td style={{ verticalAlign: 'top', paddingTop: 16 }}>
                        <div className="font-bold">{item.item_name}</div>
                      </td>
                      <td className="center num" style={{ verticalAlign: 'top', paddingTop: 16 }}>
                        {shippedFmt.value.toLocaleString('en-US', { maximumFractionDigits: 3 })} {shippedFmt.unit}
                      </td>
                      <td style={{ verticalAlign: 'top', paddingTop: 12, paddingBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            placeholder="Jml"
                            value={inputQty}
                            onChange={e => setQtys({ ...qtys, [item.id]: e.target.value === '' ? '' : Number(e.target.value) })}
                            style={{ width: 100, fontSize: 13, padding: '6px 10px' }}
                          />
                          <span style={{ fontSize: 13 }}>{shippedFmt.unit}</span>
                        </div>
                      </td>
                      <td style={{ verticalAlign: 'top', paddingTop: 12, paddingBottom: 16 }}>
                        {isDiscrepancy ? (
                          <div style={{ width: 160 }}>
                            <Input
                              value={discNotes[item.id] || ''}
                              onChange={e => setDiscNotes({ ...discNotes, [item.id]: e.target.value })}
                              placeholder="Tulis alasan..."
                              style={{ fontSize: 12, padding: '4px 8px', marginTop: 4, width: '100%' }}
                            />
                          </div>
                        ) : (
                          <span className="muted" style={{ fontSize: 12, marginTop: 4, display: 'inline-block' }}>-</span>
                        )}
                      </td>
                      <td className="center" style={{ verticalAlign: 'top', paddingTop: 16 }}>
                        <Badge variant="gray">Menunggu Scan</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {scanModal?.status !== 'DITERIMA' && (
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} style={{ whiteSpace: 'nowrap' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  {proofImage || previewUrl ? 'Ubah Foto' : 'Unggah Foto'}
                </Button>
              )}
              {scanModal?.status !== 'DITERIMA' && (
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" capture="environment" onChange={e => handlePhotoChange(e.target.files?.[0])} />
              )}
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Proof"
                  onClick={() => setViewingPhoto(true)}
                  style={{ height: 40, width: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'zoom-in' }}
                />
              )}
              {scanModal?.status === 'DITERIMA' && previewUrl && (
                <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>Bukti Pengiriman</span>
              )}
            </div>

            {allScannedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {scanModal?.status !== 'DITERIMA' && (
                  <Button
                    variant="primary"
                    type="button"
                    onClick={() => { if (scanModal) doFinalize(scanModal.id, proofImage); }}
                    disabled={uploading || !proofImage}
                    style={{ flex: 1 }}
                  >
                    {uploading ? 'Menyelesaikan...' : 'Selesaikan Penerimaan'}
                  </Button>
                )}
              </div>
            ) : (
              <form onSubmit={handleGlobalScan} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <Input
                  ref={barcodeInputRef}
                  value={globalBarcode}
                  onChange={e => setGlobalBarcode(e.target.value)}
                  placeholder={!proofImage ? 'Unggah foto dulu...' : 'Scan barcode...'}
                  disabled={scanning || !proofImage || uploading}
                  autoFocus
                  style={{ flex: 1 }}
                />
                <Button variant="primary" type="submit" disabled={scanning || !globalBarcode.trim() || !proofImage || uploading}>
                  {uploading ? 'Menyelesaikan...' : scanning ? 'Memverifikasi...' : 'Kirim Scan'}
                </Button>
              </form>
            )}
          </div>

        </div>

        <div className="modal-actions" style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="outline" onClick={() => setScanModal(null)}>Tutup</Button>
        </div>
      </Modal>

      {/* Inline Photo Viewer Overlay */}
      {viewingPhoto && previewUrl && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setViewingPhoto(false)}
            style={{
              position: 'absolute', top: 20, left: 20,
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
              color: '#fff', cursor: 'pointer', padding: '8px 16px',
              fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            Kembali
          </button>
          <img
            src={previewUrl}
            alt="Proof of delivery"
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          />
        </div>
      )}

      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />
    </section>
  );
}

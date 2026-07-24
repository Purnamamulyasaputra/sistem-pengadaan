'use client';
import { useState, useEffect, useCallback } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { MasterDataTabs } from '@/components/ui/MasterDataTabs';

interface Vendor { id: number; name: string; type?: string; email?: string; phone?: string; address?: string; tax_id?: string; website?: string; is_active: boolean; created_at: string; }

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState({ type: 'Company', name: '', street: '', street2: '', city: '', state: '', zip: '', country: '', tax_id: '', phone: '', email: '', contact_person: '', website: '', logo_url: '', is_active: true });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [confirmDelete, setConfirmDelete] = useState<Vendor | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  const [historyVendor, setHistoryVendor] = useState<Vendor | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/vendors');
    const data = await res.json();
    setVendors(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  async function openHistory(v: Vendor) {
    setHistoryVendor(v);
    setHistoryLoading(true);
    setHistoryItems([]);
    try {
      const res = await fetch(`/api/vendors/history?id=${v.id}`);
      const data = await res.json();
      if (data.success) {
        setHistoryItems(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }

  function openAdd() { setEditing(null); setForm({ type: 'Company', name: '', street: '', street2: '', city: '', state: '', zip: '', country: '', tax_id: '', phone: '', email: '', contact_person: '', website: '', logo_url: '', is_active: true }); setError(''); setShowModal(true); }
  function openEdit(v: Vendor & { type?: string, street?: string, street2?: string, city?: string, state?: string, zip?: string, country?: string, contact_person?: string, logo_url?: string }) { 
    setEditing(v); 
    setForm({ 
      type: v.type ?? 'Company', 
      name: v.name, 
      street: v.street ?? v.address ?? '', 
      street2: v.street2 ?? '', 
      city: v.city ?? '', 
      state: v.state ?? '', 
      zip: v.zip ?? '', 
      country: v.country ?? '', 
      tax_id: v.tax_id ?? '', 
      phone: v.phone ?? '', 
      email: v.email ?? '', 
      contact_person: v.contact_person ?? '', 
      website: v.website ?? '', 
      logo_url: v.logo_url ?? '',
      is_active: v.is_active ?? true 
    }); 
    setError(''); 
    setShowModal(true); 
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.success) {
        setForm(f => ({ ...f, logo_url: data.url }));
      } else {
        setError(data.message || 'Gagal mengunggah foto');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mengunggah foto');
    } finally {
      setUploading(false);
    }
  }

  async function performSave() {
    if (!form.name) { setError('Nama Supplier wajib diisi'); return false; }
    setSaving(true); setError('');
    try {
      const fullAddress = [form.street, form.street2, form.city, form.state, form.zip, form.country].filter(Boolean).join(', ');
      const method = editing ? 'PATCH' : 'POST';
      const bodyPayload = {
        name: form.name, type: form.type, email: form.email,
        phone: form.phone,
        address: fullAddress, street: form.street, street2: form.street2, city: form.city, state: form.state, zip: form.zip, country: form.country,
        contact_person: form.contact_person, logo_url: form.logo_url,
        tax_id: form.tax_id, website: form.website, is_active: form.is_active
      };
      const body = editing ? { id: editing.id, ...bodyPayload } : bodyPayload;
      const res = await fetch('/api/vendors', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) { setError(data.message); return false; }
      fetchVendors();
      return true;
    } finally { setSaving(false); }
  }

  async function handleSave() {
    const success = await performSave();
    if (success) setShowModal(false);
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    await fetch(`/api/vendors?id=${confirmDelete.id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    fetchVendors();
  }

  function formatDate(iso: string) {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }

  const paginatedVendors = vendors.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(vendors.length / ITEMS_PER_PAGE);

  return (
    <section className="screen">
      <div className="card">
        <MasterDataTabs activeTab="vendors" />
        <div className="card-head">
          <div>
            <h3>Supplier & Vendor</h3>
          </div>
          <Button variant="primary" size="sm" onClick={openAdd}>+ Tambah Vendor</Button>
        </div>

        <div className="card-body flush">
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Memuat...</div> : (
            <>
              <div className="table-responsive">
                <Table>
                  <thead><tr><th>No.</th><th>Nama Vendor</th><th>Nomor Telepon</th><th>NPWP</th><th>Tanggal Bergabung</th><th>Status</th><th className="center">Aksi</th></tr></thead>
                  <tbody>
                    {paginatedVendors.map((v, idx) => (
                      <tr key={v.id} onClick={() => openHistory(v)} style={{ cursor: 'pointer' }} className="hover:bg-slate-50 transition-colors">
                        <td className="muted">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                        <td className="font-bold">
                          {v.name}
                          {v.type && <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{v.type}</div>}
                          {v.website && <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 500, marginTop: 2 }}><a href={v.website.startsWith('http') ? v.website : `https://${v.website}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{v.website}</a></div>}
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {v.phone ? <span>{v.phone}</span> : <span className="muted">—</span>}
                        </td>
                        <td className="font-mono" style={{ fontSize: 13 }}>{v.tax_id ? v.tax_id : <span className="muted">—</span>}</td>
                        <td>{formatDate(v.created_at)}</td>
                        <td>
                          <span style={{ 
                            display: 'inline-block', 
                            padding: '4px 10px', 
                            borderRadius: '12px', 
                            fontSize: '12px', 
                            fontWeight: 600,
                            background: v.is_active ? '#dcfce7' : '#f1f5f9',
                            color: v.is_active ? '#166534' : '#475569'
                          }}>
                            {v.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="center" onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <Button size="sm" onClick={() => openEdit(v)} title="Edit" style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </Button>
                            <Button size="sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }} onClick={() => setConfirmDelete(v)} title="Delete">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedVendors.length === 0 && (
                      <tr><td colSpan={7} className="center muted" style={{ padding: 32 }}>Vendor tidak ditemukan</td></tr>
                    )}
                  </tbody>
                </Table>
              </div>
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={vendors.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Supplier' : 'Supplier Baru'} maxWidth={850}>
        <div className="modal-body" style={{ padding: '16px 24px' }}>
          {error && <div className="alert-banner alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="vendor_type" checked={form.type === 'Individual'} onChange={() => setForm(f => ({ ...f, type: 'Individual' }))} /> Individu
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="vendor_type" checked={form.type === 'Company'} onChange={() => setForm(f => ({ ...f, type: 'Company' }))} /> Perusahaan
                </label>
              </div>
              <div style={{ width: 1, background: '#e2e8f0' }}></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }} title="Ubah Status Vendor">
                <div style={{ position: 'relative', width: 32, height: 18, background: form.is_active ? '#016e3f' : '#cbd5e1', borderRadius: 9, transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: form.is_active ? 16 : 2, width: 14, height: 14, background: 'white', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }} />
                </div>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ display: 'none' }} />
                {form.is_active ? 'Aktif' : 'Nonaktif'}
              </label>
            </div>
            <div style={{ width: 64, height: 64, border: '1px dashed #cbd5e1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', cursor: 'pointer', background: '#f8fafc', position: 'relative', overflow: 'hidden' }} title="Upload Photo">
              <input type="file" accept="image/*" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} onChange={handleFileUpload} disabled={uploading} />
              {uploading ? <span style={{ fontSize: 12 }}>...</span> : form.logo_url ? <img src={form.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/><line x1="22" y1="2" x2="22" y2="8"/><line x1="19" y1="5" x2="25" y2="5"/></svg>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>Nama Supplier</label>
                 <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="misal: Olympic Furniture" />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                 <label style={{ width: 100, fontWeight: 700, fontSize: 13, paddingTop: 6 }}>Alamat</label>
                 <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                   <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} placeholder="Jalan 1..." />
                   <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.street2} onChange={e => setForm(f => ({ ...f, street2: e.target.value }))} placeholder="Jalan 2..." />
                   <div style={{ display: 'flex', gap: 6 }}>
                     <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Kota" />
                     <input className="input" style={{ width: 70, padding: '6px 10px', fontSize: 13 }} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="Provinsi" />
                     <input className="input" style={{ width: 70, padding: '6px 10px', fontSize: 13 }} value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} placeholder="Kode Pos" />
                   </div>
                   <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="Negara" />
                 </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>NPWP</label>
                 <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} placeholder="misal: BE0477472701" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>Telepon</label>
                 <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="08..." />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>Email</label>
                 <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contoh@mail.com" />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>Kontak Person</label>
                 <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} placeholder="Nama" />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>Website</label>
                 <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="misal: https://..." />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-actions" style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', gap: 8, justifyContent: 'flex-end', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          <Button variant="outline" onClick={() => setShowModal(false)}>Batal</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Konfirmasi Hapus"
        message={`Hapus vendor ${confirmDelete?.name}?`}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={executeDelete}
        confirmText="Hapus"
        danger={true}
      />

      <Modal isOpen={!!historyVendor} onClose={() => setHistoryVendor(null)} title={`Riwayat Pembelian: ${historyVendor?.name}`} maxWidth={800}>
        <div className="modal-body" style={{ padding: '20px 24px' }}>
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Memuat riwayat...</div>
          ) : historyItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', background: '#f8fafc', borderRadius: 8 }}>
              Tidak ada pesanan pembelian ditemukan untuk vendor ini.
            </div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: '60vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'left', fontWeight: 600, color: '#475569' }}>No. PO</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Tanggal</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Barang / Material</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Jml</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Harga Satuan</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '8px 12px' }} className="font-mono text-blue-600 font-medium">
                        <a href={`/procurement/orders/${item.po_id}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'var(--blue)' }}>
                          {item.po_number}
                        </a>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{formatDate(item.order_date)}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{item.item_name || item.description || '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{item.qty}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rp {(item.unit_price || 0).toLocaleString('id-ID')}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Rp {(item.subtotal || 0).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}

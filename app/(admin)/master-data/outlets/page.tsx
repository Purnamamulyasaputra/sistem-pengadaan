'use client';
import { useState, useEffect, useCallback } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { MasterDataTabs } from '@/components/ui/MasterDataTabs';

interface Outlet { id: number; name: string; type: string; address?: string; street?: string; street2?: string; city?: string; state?: string; zip?: string; country?: string; pic_name?: string; email?: string; phone?: string; map_location?: string; is_active: boolean; created_at: string; }

const TYPE_LABELS: Record<string, string> = { STORE: 'Store', CENTRAL_KITCHEN: 'Central Kitchen' };

export default function OutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [form, setForm] = useState({ name: '', type: 'STORE', address: '', street: '', street2: '', city: '', state: '', zip: '', country: '', pic_name: '', email: '', phone: '', map_location: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [confirmDelete, setConfirmDelete] = useState<Outlet | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchOutlets = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/outlets');
    const data = await res.json();
    setOutlets(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOutlets(); }, [fetchOutlets]);

  function openAdd() { setEditing(null); setForm({ name: '', type: 'STORE', address: '', street: '', street2: '', city: '', state: '', zip: '', country: '', pic_name: '', email: '', phone: '', map_location: '', is_active: true }); setError(''); setShowModal(true); }
  function openEdit(o: Outlet) { setEditing(o); setForm({ name: o.name, type: o.type, address: o.address ?? '', street: o.street ?? '', street2: o.street2 ?? '', city: o.city ?? '', state: o.state ?? '', zip: o.zip ?? '', country: o.country ?? '', pic_name: o.pic_name ?? '', email: o.email ?? '', phone: o.phone ?? '', map_location: o.map_location ?? '', is_active: o.is_active ?? true }); setError(''); setShowModal(true); }

  async function handleSave() {
    if (!form.name) { setError('Nama outlet wajib diisi'); return; }
    setSaving(true); setError('');
    try {
      const method = editing ? 'PATCH' : 'POST';
      const body = editing ? { id: editing.id, ...form } : form;
      const res = await fetch('/api/outlets', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }
      setShowModal(false); fetchOutlets();
    } finally { setSaving(false); }
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    await fetch(`/api/outlets?id=${confirmDelete.id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    fetchOutlets();
  }

  function formatDate(iso: string) {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }

  const paginatedOutlets = outlets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(outlets.length / ITEMS_PER_PAGE);

  return (
    <section className="screen">
      <div className="card">
        <MasterDataTabs activeTab="outlets" />
        <div className="card-body flush">
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Button variant="primary" size="sm" onClick={openAdd}>+ Add Outlet</Button>
          </div>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading...</div> : (
            <>
              <div className="table-responsive">
                <Table>
                  <thead><tr><th>No.</th><th>Outlet Name</th><th>Type</th><th>PIC / Contact</th><th>Status</th><th className="center">Actions</th></tr></thead>
                  <tbody>
                    {paginatedOutlets.map((o, idx) => (
                      <tr key={o.id}>
                        <td className="muted">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                        <td className="font-bold">
                          {o.name}
                        </td>
                        <td><Badge variant={o.type === 'STORE' ? 'blue' : 'green'}>{TYPE_LABELS[o.type] ?? o.type}</Badge></td>
                        <td style={{ fontSize: 13 }}>
                          {o.pic_name && <div style={{ fontWeight: 600 }}>{o.pic_name}</div>}
                          {o.phone && <div>📞 {o.phone}</div>}
                          {o.email && <div>✉️ {o.email}</div>}
                          {(!o.pic_name && !o.phone && !o.email) && <span className="muted">—</span>}
                        </td>
                        <td>
                          <span className={`badge ${o.is_active ? 'badge-green' : 'badge-gray'}`}>
                            {o.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="center">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <Button size="sm" onClick={() => openEdit(o)} title="Edit" style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </Button>
                            <Button size="sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }} onClick={() => setConfirmDelete(o)} title="Delete">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedOutlets.length === 0 && (
                      <tr><td colSpan={6} className="center muted" style={{ padding: 32 }}>No outlets found</td></tr>
                    )}
                  </tbody>
                </Table>
              </div>
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={outlets.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Outlet' : 'New Outlet'} maxWidth={850}>
        <div className="modal-body" style={{ padding: '16px 24px' }}>
          {error && <div className="alert-banner alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="outlet_type" checked={form.type === 'STORE'} onChange={() => setForm(f => ({ ...f, type: 'STORE' }))} /> Store
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="outlet_type" checked={form.type === 'CENTRAL_KITCHEN'} onChange={() => setForm(f => ({ ...f, type: 'CENTRAL_KITCHEN' }))} /> Central Kitchen
                </label>
              </div>
              <div style={{ width: 1, background: '#e2e8f0' }}></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }} title="Toggle Outlet Status">
                <div style={{ position: 'relative', width: 32, height: 18, background: form.is_active ? '#016e3f' : '#cbd5e1', borderRadius: 9, transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: form.is_active ? 16 : 2, width: 14, height: 14, background: 'white', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }} />
                </div>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ display: 'none' }} />
                {form.is_active ? 'Active' : 'Inactive'}
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>Outlet Name</label>
                 <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. ER Edhos BDG" />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>PIC</label>
                 <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={form.pic_name} onChange={e => setForm(f => ({ ...f, pic_name: e.target.value }))} placeholder="e.g. Budi Santoso" />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                 <label style={{ width: 100, fontWeight: 700, fontSize: 13, paddingTop: 6 }}>Address</label>
                 <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                   <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} placeholder="Street 1" />
                   <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.street2} onChange={e => setForm(f => ({ ...f, street2: e.target.value }))} placeholder="Street 2 (Optional)" />
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                     <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
                     <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="State / Province" />
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                     <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} placeholder="Zip / Postal" />
                     <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="Country" />
                   </div>
                 </div>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>Phone</label>
                 <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 0812-3456-7890" />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>Email</label>
                 <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="outlet@example.com" />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <label style={{ width: 100, fontWeight: 700, fontSize: 13 }}>Map Link</label>
                 <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} value={form.map_location} onChange={e => setForm(f => ({ ...f, map_location: e.target.value }))} placeholder="https://maps.google.com/..." />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-actions" style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', gap: 8, justifyContent: 'flex-end', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Confirmation"
        message={`Delete outlet ${confirmDelete?.name}? Related data referencing this outlet may not be deleted if restricted.`}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={executeDelete}
        confirmText="Delete"
        danger={true}
      />
    </section>
  );
}

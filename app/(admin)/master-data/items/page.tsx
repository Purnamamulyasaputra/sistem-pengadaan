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
import { Toggle } from '@/components/ui/Toggle';
import { Toast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';

interface Item {
  id: number; name: string; category_id: number; category_name: string; barcode?: string;
  purchase_unit: string; smallest_unit: string; conversion_ratio: number;
  minimum_threshold: number; threshold_type: string; is_perishable: boolean;
  is_active: boolean; current_average_price: number; current_stock?: number;
  is_hpp?: boolean;
  ingredient_id?: number | null;
  ingredient_name?: string;
}
interface Category { id: number; name: string; }
interface Ingredient { id: number; name: string; }

const fmtCurrency = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [filterExpiry, setFilterExpiry] = useState('');
  const [filterUnit, setFilterUnit] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({ name: '', barcode: '', category_id: '', purchase_unit: '', package_inner_size: '', smallest_unit: '', conversion_ratio: '1', minimum_threshold: '10', threshold_type: 'ABSOLUT', is_perishable: false, is_active: true, purchase_price: '0', has_conversion: false, ingredient_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toastInfo, setToastInfo] = useState<{ show: boolean, msg: string, type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'info' });

  // Stock Card
  const [confirmToggleActive, setConfirmToggleActive] = useState<Item | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ active_only: 'false' });
    if (search) params.set('search', search);
    if (catFilter) params.set('category_id', catFilter);
    const res = await fetch(`/api/items?${params}`);
    const data = await res.json();
    setItems(data.data ?? []);
    setLoading(false);
  }, [search, catFilter]);

  // Reset to page 1 only when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, catFilter, filterExpiry, filterUnit]);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.data ?? []));
    fetch('/api/hpp/ingredients?limit=500').then(r => r.json()).then(d => setIngredients(d.data ?? []));
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', barcode: '', category_id: '', purchase_unit: '', package_inner_size: '', smallest_unit: '', conversion_ratio: '1', minimum_threshold: '10', threshold_type: 'ABSOLUT', is_perishable: false, is_active: true, purchase_price: '0', has_conversion: false, ingredient_id: '' });
    setError('');
    setShowModal(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    const hasConv = Number(item.conversion_ratio) > 1 && item.purchase_unit !== item.smallest_unit;
    setForm({
      name: item.name, barcode: item.barcode || '', category_id: String(item.category_id ?? ''), purchase_unit: item.purchase_unit, package_inner_size: '',
      smallest_unit: item.smallest_unit, conversion_ratio: String(Number(item.conversion_ratio)),
      minimum_threshold: String(Number(item.minimum_threshold)), threshold_type: item.threshold_type,
      is_perishable: item.is_perishable, is_active: item.is_active,
      purchase_price: String(Number(item.current_average_price ?? 0) * Number(item.conversion_ratio || 1)),
      has_conversion: hasConv,
      ingredient_id: item.ingredient_id ? String(item.ingredient_id) : ''
    });
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.category_id || !form.purchase_unit || (form.has_conversion && !form.smallest_unit)) {
      setToastInfo({ show: true, msg: 'Nama, kategori, satuan beli, dan kelengkapan konversi wajib diisi', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/items/${editing.id}` : '/api/items';
      const method = editing ? 'PATCH' : 'POST';
      const { package_inner_size, has_conversion, purchase_price, ...cleanForm } = form;

      const finalRatio = has_conversion ? Number(form.conversion_ratio) : 1;
      const finalSmallestUnit = has_conversion ? form.smallest_unit : form.purchase_unit;
      const finalAvgPrice = has_conversion ? Number(purchase_price) / finalRatio : Number(purchase_price);

      const payload = {
        ...cleanForm,
        category_id: Number(form.category_id),
        smallest_unit: finalSmallestUnit,
        conversion_ratio: finalRatio,
        minimum_threshold: Number(form.minimum_threshold),
        current_average_price: finalAvgPrice,
        ingredient_id: form.ingredient_id ? Number(form.ingredient_id) : null
      };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      let data;
      try {
        data = await res.json();
      } catch (err) {
        setToastInfo({ show: true, msg: 'Terjadi kesalahan server saat menyimpan data.', type: 'error' });
        return;
      }
      if (!data.success) { setToastInfo({ show: true, msg: data.message, type: 'error' }); return; }
      setShowModal(false);
      fetchItems();
    } finally { setSaving(false); }
  }

  async function executeToggleActive() {
    if (!confirmToggleActive) return;
    const item = confirmToggleActive;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        setToastInfo({ show: true, msg: data.message, type: 'error' });
      } else {
        setToastInfo({ show: true, msg: data.message, type: 'success' });
      }
    } catch (err) {
      setToastInfo({ show: true, msg: 'Gagal menghubungi server', type: 'error' });
    } finally {
      setIsDeleting(false);
      setConfirmToggleActive(null);
      fetchItems();
    }
  }



  const uniqueUnits = Array.from(new Set(items.map(i => i.purchase_unit))).filter(Boolean).sort();

  const filteredItems = items.filter(item => {
    if (filterExpiry === 'SHORT' && !item.is_perishable) return false;
    if (filterUnit && item.purchase_unit !== filterUnit) return false;
    return true;
  });

  const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

  return (
    <section className="screen">
      <div className="card">
        <MasterDataTabs activeTab="items" />
        <div className="card-body flush">
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="input" placeholder="Cari nama barang..." style={{ width: '200px' }} value={search} onChange={e => setSearch(e.target.value)} />
              <Select
                value={catFilter}
                onChange={val => setCatFilter(val)}
                options={[
                  { value: '', label: 'Semua Kategori' },
                  ...categories.map(c => ({ value: String(c.id), label: c.name }))
                ]}
                style={{ width: 160 }}
                inputStyle={{ height: 32 }}
              />
              <Select
                value={filterUnit}
                onChange={val => setFilterUnit(val)}
                options={[
                  { value: '', label: 'Semua Satuan' },
                  ...uniqueUnits.map(u => ({ value: u, label: u }))
                ]}
                style={{ width: 130 }}
                inputStyle={{ height: 32 }}
              />
              <Select
                value={filterExpiry}
                onChange={val => setFilterExpiry(val)}
                options={[
                  { value: '', label: 'Semua Kedaluwarsa' },
                  { value: 'SHORT', label: 'Hanya Cepat Basi' }
                ]}
                style={{ width: 150 }}
                inputStyle={{ height: 32 }}
              />
            </div>
            <Button variant="primary" size="sm" onClick={openAdd}>+ Tambah Barang</Button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Memuat data...</div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
              <h4>Belum ada barang</h4>
              <p>Tambahkan barang baru untuk memulai</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table>
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Kode</th>
                      <th style={{ width: 300 }}>Barang</th>
                      <th style={{ width: 120 }}>Satuan Beli</th>
                      <th style={{ width: 120 }}>Satuan Terkecil</th>
                      <th className="center" style={{ width: 80 }}>Rasio</th>
                      <th className="right" style={{ width: 120 }}>Rata Harga</th>
                      <th className="center" style={{ width: 100 }}>Status</th>
                      <th className="center" style={{ width: 100 }}>Aksi</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map(item => (
                      <tr key={item.id}>
                        <td className="font-mono text-muted">ERC{String(item.id).padStart(5, '0')}</td>
                        <td>
                          <div className="font-bold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {item.name}
                            {item.is_hpp && (
                              <span style={{ fontSize: 9, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontWeight: 700, letterSpacing: 0.5 }}>HPP / RESEP</span>
                            )}
                          </div>
                          {item.is_perishable && <span style={{ fontSize: 10, color: '#d97706', fontWeight: 600 }}>CEPAT BASI</span>}
                        </td>
                        <td>{item.purchase_unit}</td>
                        <td>{item.smallest_unit}</td>
                        <td className="center num muted">{Math.round(Number(item.conversion_ratio)).toLocaleString('id-ID')}</td>
                        <td className="right num">{fmtCurrency(item.current_average_price).replace(',00', '')}</td>
                        <td className="center">
                          <Badge variant={item.is_active ? 'green' : 'gray'}>
                            {item.is_active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>
                        <td className="center">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', whiteSpace: 'nowrap' }}>
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); openEdit(item); }} title="Edit Barang" style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </Button>
                            <Button size="sm" style={{ background: item.is_active ? '#fef2f2' : '#ecfdf5', color: item.is_active ? '#dc2626' : '#059669', border: '1px solid', borderColor: item.is_active ? '#fecaca' : '#a7f3d0' }} onClick={(e) => { e.stopPropagation(); setConfirmToggleActive(item); }} title={item.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                              {item.is_active ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>}
                            </Button>
                          </div>
                        </td>
                        <td></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredItems.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Barang' : 'Tambah Barang Baru'}
        maxWidth={1024}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>Batal</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Barang'}</Button>
          </>
        }
      >
        <div style={{ padding: '0px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>

            {/* LEFT COLUMN: Main Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1.4 }}>
                  <datalist id="existing-item-names">
                    {items.map(item => <option key={item.id} value={item.name} />)}
                  </datalist>
                  <Input
                    label="Nama Barang"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="buat nama barang baru"
                    list="existing-item-names"
                  />
                </div>
                <div style={{ flex: 0.9 }}>
                  <Input
                    label="Barcode / SKU"
                    value={form.barcode || ''}
                    onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                    placeholder="Opsional"
                  />
                </div>
                <div className="form-group" style={{ flex: 1.8, marginBottom: 0 }}>
                  <label className="req">Kategori</label>
                  <Select
                    value={form.category_id}
                    onChange={val => setForm(f => ({ ...f, category_id: val }))}
                    options={[
                      { value: '', label: 'Pilih kategori...' },
                      ...categories.map(c => ({ value: String(c.id), label: c.name }))
                    ]}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="req">Satuan Beli (Terbesar)</label>
                  <Select
                    value={form.purchase_unit}
                    onChange={val => setForm(f => ({ ...f, purchase_unit: val }))}
                    options={[
                      { value: '', label: 'Pilih...' },
                      ...['Dus', 'Karton', 'Box', 'Pack', 'Bal', 'Kg', 'Liter', 'Galon', 'Jerigen', 'Roll', 'Pcs'].map(u => ({ value: u, label: u }))
                    ]}
                  />
                </div>

                <div className="form-group" style={{ flex: 1, marginBottom: 0, opacity: form.has_conversion ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                  <label className="req">Satuan Terkecil (Outlet)</label>
                  <Select
                    value={form.smallest_unit}
                    onChange={val => setForm(f => ({ ...f, smallest_unit: val }))}
                    disabled={!form.has_conversion}
                    options={[
                      { value: '', label: 'Pilih...' },
                      ...['gr', 'ml', 'pcs', 'shoot', 'slice', 'lembar', 'Kotak', 'Botol', 'Kaleng', 'Bks', 'Roll', 'Kg', 'Liter', 'Pack'].map(u => ({ value: u, label: u }))
                    ]}
                  />
                </div>

                <div className="form-group" style={{ flex: 1.5, marginBottom: 0, opacity: form.has_conversion ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                  <label className="req">Isi per 1 {form.purchase_unit || 'Satuan Beli'}</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type="number" min="0.01" step="0.01" value={form.conversion_ratio} onChange={e => setForm(f => ({ ...f, conversion_ratio: e.target.value }))} disabled={!form.has_conversion} style={{ paddingRight: 60, cursor: form.has_conversion ? 'text' : 'not-allowed' }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--muted)' }}>{form.smallest_unit}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1.2, marginBottom: 0 }}>
                  <label>Harga Beli per {form.purchase_unit || 'Satuan'} (Rp)</label>
                  <input className="input" type="text" placeholder="0" value={form.purchase_price === '0' || !form.purchase_price ? '' : Number(form.purchase_price).toLocaleString('id-ID')} onChange={e => {
                    const raw = e.target.value.replace(/\./g, '');
                    if (/^\d*$/.test(raw)) setForm(f => ({ ...f, purchase_price: raw }));
                  }} onFocus={e => e.target.select()} />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label>Batas Min.</label>
                  <input className="input" type="number" min="0" value={form.minimum_threshold} onChange={e => setForm(f => ({ ...f, minimum_threshold: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label>Jenis Peringatan</label>
                  <Select
                    value={form.threshold_type}
                    onChange={val => setForm(f => ({ ...f, threshold_type: val }))}
                    options={[
                      { value: 'ABSOLUT', label: 'Absolut' },
                      { value: 'PERSENTASE', label: 'Persentase (%)' }
                    ]}
                  />
                </div>
              </div>

              {form.has_conversion && Number(form.purchase_price) > 0 && Number(form.conversion_ratio) > 0 && (
                <div style={{ fontSize: 12.5, color: '#0369a1', background: '#e0f2fe', padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                  <span>Catatan sistem: 1 {form.purchase_unit} berisi {form.conversion_ratio} {form.smallest_unit}. Harga HPP / Stok Gudang adalah <strong>{fmtCurrency(Number(form.purchase_price) / Number(form.conversion_ratio))} per {form.smallest_unit}</strong>.</span>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Settings & Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: 8, border: '1px solid #e2e8f0', alignSelf: 'start' }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #cbd5e1', paddingBottom: 8 }}>Pengaturan & Aturan</h4>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Satuan Eceran / Terkecil</span>
                <Toggle checked={form.has_conversion} onChange={c => setForm(f => ({ ...f, has_conversion: c }))} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Barang Cepat Basi</span>
                <Toggle checked={form.is_perishable} onChange={c => setForm(f => ({ ...f, is_perishable: c }))} />
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', margin: '4px 0' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: form.is_active ? 'var(--primary)' : 'var(--muted)' }}>{form.is_active ? 'Barang Aktif' : 'Nonaktif'}</span>
                <Toggle checked={form.is_active} onChange={c => setForm(f => ({ ...f, is_active: c }))} />
              </div>
            </div>

          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmToggleActive}
        title="Hapus Barang Secara Permanen"
        message={`Apakah Anda yakin ingin menghapus "${confirmToggleActive?.name}"?`}
        onCancel={() => setConfirmToggleActive(null)}
        onConfirm={executeToggleActive}
        confirmText="Ya"
        danger={true}
        loading={isDeleting}
      />

      <Toast
        isOpen={toastInfo.show}
        message={toastInfo.msg}
        type={toastInfo.type}
        onClose={() => setToastInfo({ ...toastInfo, show: false })}
      />
    </section>
  );
}

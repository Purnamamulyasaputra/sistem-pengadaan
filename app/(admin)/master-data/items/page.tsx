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
import { HelpCircle, Info, Tag, Package, DollarSign, CheckCircle2, AlertCircle, AlertTriangle, RotateCcw } from 'lucide-react';

interface Item {
  id: number; name: string; category_id: number; category_name: string; barcode?: string;
  purchase_unit: string; smallest_unit: string; conversion_ratio: number;
  minimum_threshold: number; target_stock: number; threshold_type: string; is_perishable: boolean;
  is_active: boolean; current_average_price: number; last_purchase_price?: number; current_stock?: number;
  is_hpp?: boolean;
  ingredient_id?: number | null;
  ingredient_name?: string;
  is_split_allowed?: boolean;
  min_order_qty?: number;
  order_multiple?: number;
}
interface Category { id: number; name: string; }
interface Ingredient { id: number; name: string; unit?: string; }

const fmtCurrency = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const UNIT_ALIASES: Record<string, string> = {
  'g': 'gr',
  'l': 'liter',
  'pc': 'pcs'
};

export function normalizeUnitAlias(u: string | null | undefined): string {
  if (!u) return '';
  const lower = u.toLowerCase();
  return UNIT_ALIASES[lower] || u;
}

function getUniqueUnits(defaultUnits: string[], dynamicUnits: (string | null | undefined)[]) {
  const allUnits = [...defaultUnits, ...dynamicUnits].filter(Boolean) as string[];
  const seen = new Set<string>();
  const result: string[] = [];
  
  for (const u of allUnits) {
    const canonical = normalizeUnitAlias(u);
    const lower = canonical.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(canonical);
    }
  }
  return result.map(u => ({ value: u, label: u }));
}

function formatNumberInput(val: string | number): string {
  if (!val && val !== 0) return '';
  const str = String(val);
  if (str.endsWith('.')) {
    return Number(str.slice(0, -1)).toLocaleString('id-ID') + ',';
  }
  const parts = str.split('.');
  if (parts.length === 2) {
    return Number(parts[0]).toLocaleString('id-ID') + ',' + parts[1];
  }
  return Number(str).toLocaleString('id-ID', { maximumFractionDigits: 5 });
}

function parseNumberInput(val: string): string {
  return val.replace(/\./g, '').replace(',', '.');
}

function getStockStatus(item: Item): 'MERAH' | 'MENIPIS' | 'AMAN' {
  const stock = Number(item.current_stock || 0);
  const min = Number(item.minimum_threshold || 0);
  const target = Number(item.target_stock || 0);

  if (stock <= min) return 'MERAH';
  if (target > 0) {
    if (stock <= target) return 'MENIPIS';
    return 'AMAN';
  }
  if (stock <= min * 1.5) return 'MENIPIS';
  return 'AMAN';
}

function InfoTooltip({ text, align = 'right', width = 230 }: { text: string; align?: 'left' | 'right' | 'center'; width?: number }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 6, cursor: 'help' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <HelpCircle size={15} color="#64748b" />
      {hover && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          ...(align === 'left' ? { left: 0 } : align === 'center' ? { left: '50%', transform: 'translateX(-50%)' } : { right: 0 }),
          marginBottom: 6,
          background: '#ffffff',
          color: '#1e293b',
          border: '1px solid #cbd5e1',
          fontSize: 11.5,
          fontWeight: 500,
          padding: '10px 12px',
          borderRadius: 8,
          width,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          zIndex: 9999,
          lineHeight: 1.4,
          textAlign: 'left',
          pointerEvents: 'none'
        }}>
          {text}
          <div style={{
            position: 'absolute',
            top: '100%',
            ...(align === 'left' ? { left: 6 } : align === 'center' ? { left: '50%', transform: 'translateX(-50%)' } : { right: 6 }),
            borderWidth: '5px',
            borderStyle: 'solid',
            borderColor: '#ffffff transparent transparent transparent'
          }} />
        </div>
      )}
    </span>
  );
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [filterPerishable, setFilterPerishable] = useState('');
  const [filterStockStatus, setFilterStockStatus] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({ name: '', barcode: '', category_id: '', purchase_unit: '', package_inner_size: '', smallest_unit: '', conversion_ratio: '1', minimum_threshold: '10', target_stock: '20', threshold_type: 'ABSOLUT', is_perishable: false, is_active: true, purchase_price: '0', has_conversion: false, ingredient_id: '', is_split_allowed: false, min_order_qty: '1', order_multiple: '1' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toastInfo, setToastInfo] = useState<{ show: boolean, msg: string, type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'info' });
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

  // Stock Card
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);
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
  }, [search, catFilter, filterPerishable, filterStockStatus]);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.data ?? []));
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', barcode: '', category_id: '', purchase_unit: '', package_inner_size: '', smallest_unit: '', conversion_ratio: '1', minimum_threshold: '10', target_stock: '20', threshold_type: 'ABSOLUT', is_perishable: false, is_active: true, purchase_price: '0', has_conversion: false, ingredient_id: '', is_split_allowed: false, min_order_qty: '1', order_multiple: '1' });
    setError('');
    setShowModal(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    const hasConv = item.purchase_unit !== item.smallest_unit || Number(item.conversion_ratio) > 1;
    setForm({
      name: item.name, barcode: item.barcode || '', category_id: String(item.category_id ?? ''), 
      purchase_unit: normalizeUnitAlias(item.purchase_unit), package_inner_size: '',
      smallest_unit: normalizeUnitAlias(item.smallest_unit), conversion_ratio: String(Number(item.conversion_ratio)),
      minimum_threshold: String(Number(item.minimum_threshold)), target_stock: String(Number(item.target_stock ?? 0)), threshold_type: item.threshold_type,
      is_perishable: item.is_perishable, is_active: item.is_active,
      purchase_price: String(Number(item.current_average_price ?? 0) * Number(item.conversion_ratio || 1)),
      has_conversion: hasConv,
      ingredient_id: item.ingredient_id ? String(item.ingredient_id) : '',
      is_split_allowed: item.is_split_allowed ?? false,
      min_order_qty: String(Number(item.min_order_qty ?? 1)),
      order_multiple: String(Number(item.order_multiple ?? 1))
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
        target_stock: Number(form.target_stock),
        current_average_price: finalAvgPrice,
        ingredient_id: form.ingredient_id ? Number(form.ingredient_id) : null,
        is_split_allowed: Boolean(form.is_split_allowed),
        min_order_qty: Number(form.min_order_qty || 1),
        order_multiple: Number(form.order_multiple || 1)
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

  async function handleDelete() {
    if (!confirmDelete) return;
    const item = confirmDelete;
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
      setConfirmDelete(null);
      fetchItems();
    }
  }



  const filteredItems = items.filter(item => {
    if (filterPerishable === 'PERISHABLE' && !item.is_perishable) return false;
    if (filterPerishable === 'DURABLE' && item.is_perishable) return false;
    if (filterStockStatus && getStockStatus(item) !== filterStockStatus) return false;
    return true;
  });

  const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

  const matchingExistingItems = items
    .filter(i => i.name.toLowerCase().includes(form.name.trim().toLowerCase()))
    .slice(0, 8);

  const stokMerahCount = items.filter(i => getStockStatus(i) === 'MERAH').length;
  const stokMenipisCount = items.filter(i => getStockStatus(i) === 'MENIPIS').length;

  return (
    <section className="screen">
      <div className="card">
        <MasterDataTabs activeTab="items" />
        <div className="card-body flush">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#ffffff' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="input"
                placeholder="Cari nama barang atau SKU..."
                style={{ width: '220px', height: 34 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <Select
                value={catFilter}
                onChange={val => setCatFilter(String(val))}
                options={[
                  { value: '', label: 'Semua Kategori' },
                  ...categories.map(c => ({ value: String(c.id), label: c.name }))
                ]}
                style={{ width: 170 }}
                inputStyle={{ height: 34 }}
              />
              <Select
                value={filterPerishable}
                onChange={val => setFilterPerishable(String(val))}
                options={[
                  { value: '', label: 'Semua Sifat' },
                  { value: 'PERISHABLE', label: 'Cepat Basi' },
                  { value: 'DURABLE', label: 'Tahan Lama' }
                ]}
                style={{ width: 140 }}
                inputStyle={{ height: 34 }}
              />
              <Select
                value={filterStockStatus}
                onChange={val => setFilterStockStatus(String(val))}
                options={[
                  { value: '', label: 'Semua Stok' },
                  { value: 'MERAH', label: stokMerahCount > 0 ? `Stok Merah (${stokMerahCount})` : 'Stok Merah' },
                  { value: 'MENIPIS', label: stokMenipisCount > 0 ? `Stok Menipis (${stokMenipisCount})` : 'Stok Menipis' },
                  { value: 'AMAN', label: 'Stok Aman' }
                ]}
                style={{ width: 170 }}
                inputStyle={{ height: 34 }}
              />
              {(search || catFilter || filterPerishable || filterStockStatus) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCatFilter('');
                    setFilterPerishable('');
                    setFilterStockStatus('');
                  }}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    cursor: 'pointer',
                    padding: '0 10px',
                    borderRadius: 6,
                    height: 34,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Reset Filter"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
            <Button variant="primary" size="sm" onClick={openAdd} style={{ height: 34 }}>+ Tambah Barang</Button>
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
                      <th style={{ width: 140 }}>Satuan (Beli / Ecer)</th>
                      <th className="center" style={{ width: 80 }}>Rasio</th>
                      <th className="right" style={{ width: 120 }}>Rata Harga</th>
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
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            {!item.is_active && <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>NONAKTIF</span>}
                            {item.is_perishable && <span style={{ fontSize: 10, color: '#d97706', fontWeight: 600 }}>CEPAT BASI</span>}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="font-bold">{item.purchase_unit}</span>
                            <span className="muted" style={{ fontSize: 12 }}>/ {item.smallest_unit}</span>
                          </div>
                        </td>
                        <td className="center num muted">{Math.round(Number(item.conversion_ratio)).toLocaleString('id-ID')}</td>
                        <td className="right num">{fmtCurrency(item.current_average_price).replace(',00', '')}</td>
                        <td className="center">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', whiteSpace: 'nowrap' }}>
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); openEdit(item); }} title="Edit Barang" style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </Button>
                            <Button size="sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }} onClick={(e) => { e.stopPropagation(); setConfirmDelete(item); }} title="Hapus Barang">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: '24px' }}>

            {/* LEFT COLUMN: Main Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1.4, position: 'relative' }}>
                  <Input
                    label="Nama Barang"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    onFocus={() => setShowNameSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                    placeholder="buat nama barang baru"
                  />
                  {showNameSuggestions && matchingExistingItems.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#ffffff',
                      border: '1px solid var(--border)',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      zIndex: 99999,
                      maxHeight: 220,
                      overflowY: 'auto',
                      borderRadius: '6px',
                      marginTop: '4px'
                    }}>
                      {matchingExistingItems.map(item => (
                        <div
                          key={item.id}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#12201a',
                            background: '#ffffff',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                          onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setForm(f => ({ ...f, name: item.name }));
                            setShowNameSuggestions(false);
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: '#12201a' }}>{item.name}</div>
                            {item.barcode && <div style={{ fontSize: '11px', color: '#65786f' }}>SKU: {item.barcode}</div>}
                          </div>
                          <span style={{ fontSize: '11px', color: '#475569', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            Sudah ada
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
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
                    onChange={val => setForm(f => ({ ...f, category_id: String(val) }))}
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
                    searchable
                    creatable
                    value={form.purchase_unit}
                    onChange={val => setForm(f => ({ ...f, purchase_unit: String(val) }))}
                    placeholder="Pilih atau cari..."
                    options={[
                      { value: '', label: 'Pilih...' },
                      ...getUniqueUnits(['Kg', 'gr', 'Liter', 'ml', 'Dus', 'Karton', 'Box', 'Pack', 'Bal', 'Galon', 'Jerigen', 'Roll', 'Pcs'], items.map(i => i.purchase_unit))
                    ]}
                  />
                </div>

                <div className="form-group" style={{ flex: 1, marginBottom: 0, opacity: form.has_conversion ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                  <label className="req">Satuan Terkecil (Outlet)</label>
                  <Select
                    searchable
                    creatable
                    value={form.smallest_unit}
                    onChange={val => setForm(f => ({ ...f, smallest_unit: String(val) }))}
                    disabled={!form.has_conversion}
                    placeholder="Pilih atau cari..."
                    options={[
                      { value: '', label: 'Pilih...' },
                      ...getUniqueUnits(['gr', 'ml', 'Pcs', 'Shoot', 'Slice', 'Lembar', 'Kotak', 'Botol', 'Kaleng', 'Bks', 'Roll', 'Kg', 'Liter', 'Pack'], items.map(i => i.smallest_unit))
                    ]}
                  />
                </div>

                <div className="form-group" style={{ flex: 1.5, marginBottom: 0, opacity: form.has_conversion ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <label className="req" style={{ marginBottom: 0 }}>Isi per 1 {form.purchase_unit || 'Satuan Beli'}</label>
                    <InfoTooltip
                      align="left"
                      width={280}
                      text={
                        form.has_conversion && Number(form.purchase_price) > 0 && Number(form.conversion_ratio) > 0
                          ? `1 ${form.purchase_unit} = ${form.conversion_ratio} ${form.smallest_unit} • Harga HPP (Moving Avg): ${fmtCurrency(Number(form.purchase_price) / Number(form.conversion_ratio))} per ${form.smallest_unit}${
                              editing?.last_purchase_price != null && Number(editing.last_purchase_price) > 0
                                ? ` • Beli Terakhir: ${fmtCurrency(Number(editing.last_purchase_price))} per ${editing.smallest_unit}`
                                : ''
                            }`
                          : 'Masukkan angka konversi dari satuan beli (contoh: 1 Kg berisi 1000 gr).'
                      }
                    />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input 
                      className="input" 
                      type="text" 
                      value={formatNumberInput(form.conversion_ratio)} 
                      onChange={e => {
                        const raw = parseNumberInput(e.target.value);
                        if (/^\d*\.?\d*$/.test(raw)) setForm(f => ({ ...f, conversion_ratio: raw }));
                      }} 
                      disabled={!form.has_conversion} 
                      style={{ paddingRight: 60, cursor: form.has_conversion ? 'text' : 'not-allowed' }} 
                    />
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
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ marginBottom: 0 }}>Batas Min. {form.smallest_unit ? `(${form.smallest_unit})` : ''}</label>
                    <InfoTooltip align="left" width={230} text="Stok kritis terendah di outlet. Jika stok mencapai angka ini, sistem memberi peringatan merah (Reorder Point)." />
                  </div>
                  <input 
                    className="input" 
                    type="text" 
                    value={formatNumberInput(form.minimum_threshold)} 
                    onChange={e => {
                      const raw = parseNumberInput(e.target.value);
                      if (/^\d*\.?\d*$/.test(raw)) setForm(f => ({ ...f, minimum_threshold: raw }));
                    }} 
                  />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ marginBottom: 0 }}>Target Stok. {form.smallest_unit ? `(${form.smallest_unit})` : ''}</label>
                    <InfoTooltip align="left" width={230} text="Stok ideal/maksimal di outlet. Sistem menghitung saran pembelian berdasarkan selisih Target Stok dikurangi Stok Saat Ini." />
                  </div>
                  <input 
                    className="input" 
                    type="text" 
                    value={formatNumberInput(form.target_stock)} 
                    onChange={e => {
                      const raw = parseNumberInput(e.target.value);
                      if (/^\d*\.?\d*$/.test(raw)) setForm(f => ({ ...f, target_stock: raw }));
                    }} 
                  />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ marginBottom: 0 }}>Jenis Peringatan</label>
                    <InfoTooltip align="right" width={230} text="Pilih 'Absolut' (acuan jumlah fisik barang) atau 'Persentase' (acuan persentase dari target stok)." />
                  </div>
                  <Select
                    value={form.threshold_type}
                    onChange={val => setForm(f => ({ ...f, threshold_type: String(val) }))}
                    options={[
                      { value: 'ABSOLUT', label: 'Absolut' },
                      { value: 'PERSENTASE', label: 'Persentase (%)' }
                    ]}
                  />
                </div>
              </div>

              {Number(form.purchase_price) > 0 && Number(form.conversion_ratio) > 0 && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#15803d',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 4,
                  marginBottom: 4
                }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>Keterangan Harga HPP per {form.smallest_unit || 'Satuan Terkecil'}:</span>{' '}
                    {form.has_conversion && Number(form.conversion_ratio) > 1 ? (
                      <>
                        1 {form.purchase_unit || 'Satuan'} ({fmtCurrency(Number(form.purchase_price))}) : {Number(form.conversion_ratio).toLocaleString('id-ID')} {form.smallest_unit || 'Satuan'} ={' '}
                        <strong style={{ fontSize: '14px', color: '#166534' }}>
                          {fmtCurrency(Number(form.purchase_price) / Number(form.conversion_ratio))} / {form.smallest_unit || 'satuan'}
                        </strong>
                      </>
                    ) : (
                      <strong style={{ fontSize: '14px', color: '#166534' }}>
                        {fmtCurrency(Number(form.purchase_price))} / {form.smallest_unit || form.purchase_unit || 'satuan'}
                      </strong>
                    )}
                  </div>
                  {editing?.last_purchase_price != null && Number(editing.last_purchase_price) > 0 && (
                    <span style={{ fontSize: '12px', color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      Beli Terakhir: {fmtCurrency(Number(editing.last_purchase_price))} / {editing.smallest_unit}
                    </span>
                  )}
                </div>
              )}

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px', marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                      Aturan Pengiriman Gudang Pusat
                    </span>
                    <InfoTooltip align="left" width={260} text="Mengatur minimal pembelian & kelipatan order outlet ke gudang pusat. Aturan pembulatan kemasan diatur melalui toggle 'Pusat Boleh Kirim Pecahan' di kolom kanan." />
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: form.is_split_allowed ? '#059669' : '#475569', background: form.is_split_allowed ? '#ecfdf5' : '#f1f5f9', padding: '3px 8px', borderRadius: 6, border: '1px solid', borderColor: form.is_split_allowed ? '#a7f3d0' : '#e2e8f0' }}>
                    {form.is_split_allowed ? <CheckCircle2 size={13} color="#059669" /> : <Package size={13} color="#64748b" />}
                    {form.is_split_allowed ? 'Kirim Pecahan / Desimal' : 'Kirim Kemasan Utuh (Bulat)'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ marginBottom: 0 }}>Min. Pengiriman ({form.purchase_unit || 'Satuan Pusat'})</label>
                      <InfoTooltip align="left" width={220} text="Jumlah minimal barang yang harus dipesan dalam 1 kali order." />
                    </div>
                    <input
                      className="input"
                      type="number"
                      min="0.01"
                      step="any"
                      value={form.min_order_qty}
                      onChange={e => setForm(f => ({ ...f, min_order_qty: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ marginBottom: 0 }}>Kelipatan Kirim ({form.purchase_unit || 'Satuan Pusat'})</label>
                      <InfoTooltip align="left" width={220} text="Pesanan akan dibulatkan sesuai kelipatan angka ini (misal kelipatan 5: pesanan 7 dibulatkan ke 10)." />
                    </div>
                    <input
                      className="input"
                      type="number"
                      min="0.01"
                      step="any"
                      value={form.order_multiple}
                      onChange={e => setForm(f => ({ ...f, order_multiple: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Settings & Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc', padding: '18px 16px', borderRadius: 8, border: '1px solid #e2e8f0', alignSelf: 'start' }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #cbd5e1', paddingBottom: 8 }}>
                Pengaturan & Aturan
              </h4>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Satuan Eceran / Terkecil</span>
                  <InfoTooltip text="Aktifkan jika barang memiliki satuan outlet (contoh: Beli Kg, Pakai gram)." />
                </div>
                <Toggle checked={form.has_conversion} onChange={c => setForm(f => ({ ...f, has_conversion: c }))} />
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', margin: '2px 0' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Pusat Boleh Kirim Pecahan</span>
                  <InfoTooltip text="Aktif: Pusat boleh kirim angka desimal (contoh: 1,5 Kg). Nonaktif: Wajib kemasan utuh, saran PO dibulatkan ke atas (contoh: 1,5 Kg → 2 Kg)." />
                </div>
                <Toggle checked={form.is_split_allowed} onChange={c => setForm(f => ({ ...f, is_split_allowed: c }))} />
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', margin: '2px 0' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Barang Cepat Basi</span>
                  <InfoTooltip text="Aktifkan untuk barang perishable / mudah rusak agar sistem memberi prioritas stok & peringatan." />
                </div>
                <Toggle checked={form.is_perishable} onChange={c => setForm(f => ({ ...f, is_perishable: c }))} />
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', margin: '4px 0' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: form.is_active ? 'var(--primary)' : 'var(--muted)' }}>
                    {form.is_active ? 'Barang Aktif' : 'Nonaktif'}
                  </span>
                  <InfoTooltip text="Barang aktif dapat dipesan oleh outlet. Nonaktifkan untuk menyembunyikan sementara." />
                </div>
                <Toggle checked={form.is_active} onChange={c => setForm(f => ({ ...f, is_active: c }))} />
              </div>
            </div>

          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus Barang Secara Permanen"
        message={`Apakah Anda yakin ingin menghapus "${confirmDelete?.name}"?`}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
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

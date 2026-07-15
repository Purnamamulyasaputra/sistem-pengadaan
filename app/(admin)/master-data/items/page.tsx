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

interface Item {
  id: number; name: string; category_id: number; category_name: string; barcode?: string;
  purchase_unit: string; package_unit?: string | null; package_qty?: number | null; smallest_unit: string; conversion_ratio: number;
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
  const [filterLowStock, setFilterLowStock] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({ name: '', category_id: '', purchase_unit: '', package_unit: '', package_qty: '', package_inner_size: '', smallest_unit: '', conversion_ratio: '1', minimum_threshold: '10', threshold_type: 'ABSOLUT', is_perishable: false, is_active: true, current_average_price: '0', ingredient_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toastInfo, setToastInfo] = useState<{ show: boolean, msg: string, type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'info' });

  // Stock Card
  const [showCardModal, setShowCardModal] = useState<Item | null>(null);
  const [stockCard, setStockCard] = useState<unknown[]>([]);

  // Confirms
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
  }, [search, catFilter, filterExpiry, filterUnit, filterLowStock]);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.data ?? []));
    fetch('/api/hpp/ingredients?limit=500').then(r => r.json()).then(d => setIngredients(d.data ?? []));
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', category_id: '', purchase_unit: '', package_unit: '', package_qty: '', package_inner_size: '', smallest_unit: '', conversion_ratio: '1', minimum_threshold: '10', threshold_type: 'ABSOLUT', is_perishable: false, is_active: true, current_average_price: '0', ingredient_id: '' });
    setError('');
    setShowModal(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setForm({
      name: item.name, category_id: String(item.category_id ?? ''), purchase_unit: item.purchase_unit, package_unit: item.package_unit || '', package_qty: String(item.package_qty || ''), package_inner_size: '',
      smallest_unit: item.smallest_unit, conversion_ratio: String(Number(item.conversion_ratio)),
      minimum_threshold: String(Number(item.minimum_threshold)), threshold_type: item.threshold_type,
      is_perishable: item.is_perishable, is_active: item.is_active, current_average_price: String(Number(item.current_average_price ?? 0)),
      ingredient_id: item.ingredient_id ? String(item.ingredient_id) : ''
    });
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.category_id || !form.purchase_unit || !form.smallest_unit) {
      setError('Nama, kategori, satuan beli, dan satuan terkecil wajib diisi');
      return;
    }
    setSaving(true); setError('');
    try {
      const url = editing ? `/api/items/${editing.id}` : '/api/items';
      const method = editing ? 'PATCH' : 'POST';
      const { package_unit, package_qty, package_inner_size, ...cleanForm } = form;
      const payload = {
        ...cleanForm,
        category_id: Number(form.category_id),
        conversion_ratio: Number(form.conversion_ratio),
        minimum_threshold: Number(form.minimum_threshold),
        current_average_price: Number(form.current_average_price),
        ingredient_id: form.ingredient_id ? Number(form.ingredient_id) : null
      };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }
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

  async function handleViewCard(item: Item) {
    setShowCardModal(item);
    const res = await fetch(`/api/inventory/card?item_id=${item.id}&limit=30`);
    const data = await res.json();
    setStockCard(data.data ?? []);
  }

  const uniqueUnits = Array.from(new Set(items.map(i => i.purchase_unit))).filter(Boolean).sort();

  const filteredItems = items.filter(item => {
    if (filterExpiry === 'SHORT' && !item.is_perishable) return false;
    if (filterUnit && item.purchase_unit !== filterUnit) return false;
    if (filterLowStock === 'LOW' && (item.current_stock ?? 0) >= item.minimum_threshold) return false;
    return true;
  });

  const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const lowStockCount = items.filter(i => Number(i.current_stock ?? 0) < Number(i.minimum_threshold)).length;

  return (
    <section className="screen">
      <div className="card">
        <MasterDataTabs activeTab="items" />
        <div className="card-body flush">
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="input" placeholder="Search item name..." style={{ width: '200px' }} value={search} onChange={e => setSearch(e.target.value)} />
              <select className="input" style={{ width: '160px' }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="input" style={{ width: '130px' }} value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                <option value="">All Units</option>
                {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select className="input" style={{ width: '150px' }} value={filterExpiry} onChange={e => setFilterExpiry(e.target.value)}>
                <option value="">All Expiry Types</option>
                <option value="SHORT">Short Expiry Only</option>
              </select>
              <select className="input" style={{ width: '150px' }} value={filterLowStock} onChange={e => setFilterLowStock(e.target.value)}>
                <option value="">All Stock Levels</option>
                <option value="LOW">Low Stock Only</option>
              </select>
            </div>
            <Button variant="primary" size="sm" onClick={openAdd}>+ Add Item</Button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading data...</div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
              <h4>No items</h4>
              <p>Add new item to get started</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table>
                  <thead>
                    <tr>
                      <th>Code</th><th>Item</th>
                      <th>Purch. Unit</th><th>Small. Unit</th><th className="center">Ratio</th><th className="right">Avg Price</th>
                      <th className="right">Stock</th><th className="center">Min</th>
                      <th className="center">Status</th><th className="center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map(item => (
                      <tr key={item.id} onClick={() => handleViewCard(item)} className="cursor-pointer" title="View Stock Card">
                        <td className="font-mono text-muted">ERC{String(item.id).padStart(5, '0')}</td>
                        <td>
                          <div className="font-bold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {item.name}
                            {item.is_hpp && (
                              <span style={{ fontSize: 9, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontWeight: 700, letterSpacing: 0.5 }}>HPP / RECIPE</span>
                            )}
                          </div>
                          {item.is_perishable && <span style={{ fontSize: 10, color: '#d97706', fontWeight: 600 }}>SHORT EXPIRY</span>}
                        </td>
                        <td>{item.purchase_unit}</td>
                        <td>{item.smallest_unit}</td>
                        <td className="center num muted">{Math.round(Number(item.conversion_ratio)).toLocaleString('id-ID')}</td>
                        <td className="right num">{fmtCurrency(item.current_average_price).replace(',00', '')}</td>
                        <td className="right num font-bold" style={{ color: Number(item.current_stock ?? 0) < Number(item.minimum_threshold) ? '#dc2626' : 'inherit' }}>
                          {Math.round(Number(item.current_stock ?? 0)).toLocaleString('id-ID')}
                        </td>
                        <td className="center num muted">
                          {Math.round(Number(item.minimum_threshold)).toLocaleString('id-ID')}{item.threshold_type === 'PERSENTASE' ? '%' : ''}
                        </td>
                        <td className="center">
                          <Badge variant={item.is_active ? 'green' : 'gray'}>
                            {item.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="center">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', whiteSpace: 'nowrap' }}>
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); openEdit(item); }} title="Edit Item" style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </Button>
                            <Button size="sm" style={{ background: item.is_active ? '#fef2f2' : '#ecfdf5', color: item.is_active ? '#dc2626' : '#059669', border: '1px solid', borderColor: item.is_active ? '#fecaca' : '#a7f3d0' }} onClick={(e) => { e.stopPropagation(); setConfirmToggleActive(item); }} title={item.is_active ? 'Deactivate' : 'Activate'}>
                              {item.is_active ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>}
                            </Button>
                          </div>
                        </td>
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Item' : 'Add New Item'} maxWidth={600}>
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          {error && <div className="alert-banner alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
          <div className="form-grid" style={{ marginBottom: 0, gap: '12px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <datalist id="existing-item-names">
                {items.map(item => <option key={item.id} value={item.name} />)}
              </datalist>
              <Input
                label="Item Name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="create new item name"
                list="existing-item-names"
              />
            </div>
            <div className="form-group"><label className="req">Category</label>
              <select className="input" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label className="req">Purch. Unit</label>
                <select className="input" value={form.purchase_unit} onChange={e => setForm(f => ({ ...f, purchase_unit: e.target.value }))}>
                  <option value="">Select...</option>
                  {['Dus', 'Karton', 'Box', 'Pack', 'Bal', 'Kg', 'Liter', 'Galon', 'Jerigen', 'Roll', 'Pcs'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label className="req">Smallest Unit</label>
                <select className="input" value={form.smallest_unit} onChange={e => setForm(f => ({ ...f, smallest_unit: e.target.value }))}>
                  <option value="">Select...</option>
                  {['gr', 'ml', 'pcs', 'shoot', 'slice', 'lembar'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label>Conversion Ratio</label>
                <input className="input" type="number" min="0.01" step="0.01" value={form.conversion_ratio} onChange={e => setForm(f => ({ ...f, conversion_ratio: e.target.value }))} />
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', marginTop: 4 }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label>Min. Threshold</label>
                <input className="input" type="number" min="0" value={form.minimum_threshold} onChange={e => setForm(f => ({ ...f, minimum_threshold: e.target.value }))} />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label>Type</label>
                <select className="input" value={form.threshold_type} onChange={e => setForm(f => ({ ...f, threshold_type: e.target.value }))}>
                  <option value="ABSOLUT">Absolute</option>
                  <option value="PERSENTASE">Percentage (%)</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label>Avg Price (Rp)</label>
                <input className="input" type="text" placeholder="0" value={form.current_average_price === '0' || !form.current_average_price ? '' : Number(form.current_average_price).toLocaleString('id-ID')} onChange={e => {
                  const raw = e.target.value.replace(/\./g, '');
                  if (/^\d*$/.test(raw)) setForm(f => ({ ...f, current_average_price: raw }));
                }} onFocus={e => e.target.select()} />
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 24, marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Toggle checked={form.is_perishable} onChange={c => setForm(f => ({ ...f, is_perishable: c }))} />
                <span>Short Expiry</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Toggle checked={form.is_active} onChange={c => setForm(f => ({ ...f, is_active: c }))} />
                <span style={{ color: form.is_active ? '#016e3f' : '#64748b', fontWeight: 600 }}>
                  {form.is_active ? 'Item Active' : 'Item Inactive'}
                </span>
              </label>
            </div>
          </div>
        </div>
        <div className="modal-actions" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', gap: 8, justifyContent: 'flex-end', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Item'}</Button>
        </div>
      </Modal>

      <Modal isOpen={!!showCardModal} onClose={() => setShowCardModal(null)} title={`Stock Card — ${showCardModal?.name}`} maxWidth={800}>
        <Table>
          <thead><tr><th>Date</th><th className="center">Type</th><th className="right">Change</th><th className="right">Ending Balance</th><th>Reference</th></tr></thead>
          <tbody>
            {stockCard.length === 0 && <tr><td colSpan={5} className="center muted" style={{ padding: 24 }}>No mutations</td></tr>}
            {(stockCard as { id: number; created_at: string; movement_type: string; qty_change: number; ending_balance: number; reference_type: string }[]).map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="center"><Badge variant={log.movement_type === 'IN' ? 'green' : log.movement_type === 'OUT' ? 'red' : 'amber'}>{log.movement_type}</Badge></td>
                <td className="right num font-bold" style={{ color: log.qty_change > 0 ? '#059669' : '#dc2626' }}>
                  {log.qty_change > 0 ? '+' : ''}{Number(log.qty_change).toLocaleString('id-ID')} {showCardModal?.smallest_unit}
                </td>
                <td className="right num">{Number(log.ending_balance).toLocaleString('id-ID')} {showCardModal?.smallest_unit}</td>
                <td className="muted">{log.reference_type}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="modal-actions" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" onClick={() => setShowCardModal(null)}>Close</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmToggleActive}
        title="Delete Item Permanently"
        message={`Are you sure you want to delete "${confirmToggleActive?.name}"?`}
        onCancel={() => setConfirmToggleActive(null)}
        onConfirm={executeToggleActive}
        confirmText="Yes"
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

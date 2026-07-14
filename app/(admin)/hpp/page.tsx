'use client';
import { useState, useEffect, useCallback } from 'react';
import { Table } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// ─── Types ───────────────────────────────────────────────────
type Category = { id: number; name: string };
type Venue = { id: number; name: string };

type MenuRow = {
  id: number; category_name: string; name: string;
  variant: string | null; display_name: string | null;
  sale_price: number; hpp: number | null; hpp_ratio: number | null;
  margin_flag: 'GREEN' | 'YELLOW' | 'RED' | null;
};
type RecipeRow = {
  id: number; venue_name: string; name: string; source_sheet: string;
  yield: number; yield_unit: string | null;
  subtotal: number | null; total_cost: number | null; sale_price: number | null;
};
type IngRow = {
  id: number; name: string; default_unit: string | null;
  standard_cost_per_unit: number | null; description: string | null;
  used_in_recipes: number;
};
type KitchenRow = {
  recipe_name: string; source_sheet: string; yield_amount: number;
  yield_unit: string | null; sale_price: number;
  raw_cost: number | null; total_cost_with_xfactor: number | null;
  cost_per_unit_yield: number | null; hpp_ratio_pct: number | null;
};
type Stats = {
  totalMenus: number; totalIngredients: number; totalRecipes: number;
  byVenue: { venue: string; count: number }[];
  marginBreakdown: { flag: string; count: number }[];
};

// ─── Helpers ─────────────────────────────────────────────────
const rp = (v: number | null) =>
  v == null ? '—' : `Rp ${Math.round(Number(v)).toLocaleString('id-ID')}`;

const pct = (v: number | null) =>
  v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`;

import { CheckCircle2, AlertCircle, XCircle, Calculator, PackageSearch, FileText, ChevronLeft, ChevronRight, X, Pencil, Trash2, Package, Save } from 'lucide-react';

function MarginBadge({ flag }: { flag: string | null }) {
  if (!flag) return <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>;
  const colors: Record<string, { bg: string; text: string; border: string; icon: any }> = {
    GREEN: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', icon: CheckCircle2 },
    YELLOW: { bg: '#fefce8', text: '#a16207', border: '#fef08a', icon: AlertCircle },
    RED: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', icon: XCircle },
  };
  const c = colors[flag] ?? { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', icon: CheckCircle2 };
  const Icon = c.icon;
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: 4
    }}>
      <Icon size={12} strokeWidth={2.5} /> {flag.charAt(0) + flag.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Tab components ───────────────────────────────────────────

function MenusTab({ categories }: { categories: Category[] }) {
  const [data, setData] = useState<MenuRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catId, setCatId] = useState('');
  const [marginFlag, setMarginFlag] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const load = useCallback(() => {
    setLoading(true);
    let url = `/api/hpp?limit=${limit}&page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (catId) url += `&category_id=${catId}`;
    if (marginFlag) url += `&margin_flag=${marginFlag}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d.data ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [search, catId, marginFlag, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input" placeholder="Search menu name..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ width: 220 }}
        />
        <select className="input" value={catId} onChange={e => { setCatId(e.target.value); setPage(1); }} style={{ width: 180 }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={marginFlag} onChange={e => { setMarginFlag(e.target.value); setPage(1); }} style={{ width: 150 }}>
          <option value="">All Margins</option>
          <option value="GREEN">Green (&lt;35%)</option>
          <option value="YELLOW">Yellow (35–50%)</option>
          <option value="RED">Red (&gt;50%)</option>
        </select>
        <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>
          {total} Menus found
        </span>
      </div>

      {/* Table */}
      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading data...</div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <p className="muted">No data matched the filters.</p>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Menu / Variant</th>
                <th className="right">Sale Price</th>
                <th className="right">COGS</th>
                <th className="right">Gross Profit</th>
                <th className="right">COGS %</th>
                <th className="right">Margin %</th>
                <th className="center">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id}>
                  <td><span style={{ fontSize: 12, color: 'var(--muted)', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{row.category_name}</span></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.display_name ?? row.name}</div>
                    {row.variant && <div className="muted" style={{ fontSize: 12 }}>{row.variant}</div>}
                  </td>
                  <td className="right " style={{ fontWeight: 600 }}>{rp(row.sale_price)}</td>
                  <td className="right ">{rp(row.hpp)}</td>
                  <td className="right " style={{ fontWeight: 600, color: '#059669' }}>
                    {row.hpp == null ? '—' : rp(row.sale_price - row.hpp)}
                  </td>
                  <td className="right " style={{ color: row.hpp_ratio && row.hpp_ratio > 0.5 ? '#dc2626' : row.hpp_ratio && row.hpp_ratio > 0.35 ? '#d97706' : '#166534' }}>
                    {pct(row.hpp_ratio)}
                  </td>
                  <td className="right " style={{ fontWeight: 600 }}>
                    {row.hpp_ratio == null ? '—' : pct(1 - row.hpp_ratio)}
                  </td>
                  <td className="center"><MarginBadge flag={row.margin_flag} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={16} />
          </button>
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Page {page} of {totalPages}</span>
          <button className="btn" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}

function RecipesTab({ venues }: { venues: Venue[] }) {
  const [data, setData] = useState<RecipeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [venueId, setVenueId] = useState('');
  const [sheet, setSheet] = useState('');
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const limit = 20;

  const SHEETS = ['Bar 1', 'Bar 2', 'Kitchen 2025', 'Turangga'];

  const load = useCallback(() => {
    setLoading(true);
    let url = `/api/hpp/recipes?limit=${limit}&page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (venueId) url += `&venue_id=${venueId}`;
    if (sheet) url += `&source_sheet=${encodeURIComponent(sheet)}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d.data ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [search, venueId, sheet, page]);

  useEffect(() => { load(); }, [load]);

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/hpp/recipes/${deleteConfirm}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete recipe');
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div style={{ display: 'flex', gap: 12, padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" placeholder="Search recipe name..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: 220 }} />
        <select className="input" value={venueId} onChange={e => { setVenueId(e.target.value); setPage(1); }} style={{ width: 150 }}>
          <option value="">All Venues</option>
          {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select className="input" value={sheet} onChange={e => { setSheet(e.target.value); setPage(1); }} style={{ width: 160 }}>
          <option value="">All Sheets</option>
          {SHEETS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{total} recipes</span>
        <a href="/hpp/recipe-builder/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>+ Add Recipe</a>
      </div>

      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading data...</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Recipe Name</th>
                <th>Venue / Sheet</th>
                <th className="right">Yield</th>
                <th className="right">Ingredients Subtotal</th>
                <th className="right">Total COGS</th>
                <th className="right">Sale Price</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 600 }}>{row.name}</td>
                  <td>
                    <div>{row.venue_name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{row.source_sheet}</div>
                  </td>
                  <td className="right ">{Number(row.yield).toLocaleString('id-ID')} <span className="muted">{row.yield_unit ?? 'pcs'}</span></td>
                  <td className="right ">{rp(row.subtotal)}</td>
                  <td className="right " style={{ fontWeight: 700, color: '#016e3f' }}>{rp(row.total_cost)}</td>
                  <td className="right ">{row.sale_price ? rp(row.sale_price) : <span className="muted">Base Prep</span>}</td>
                  <td className="right">
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                      <a href={`/hpp/recipe-builder/${row.id}`} className="btn" style={{ padding: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 6 }}>
                        <Pencil size={14} />
                      </a>
                      <button className="btn" style={{ padding: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 6 }} onClick={() => setDeleteConfirm(row.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={16} />
          </button>
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Page {page} of {totalPages}</span>
          <button className="btn" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Recipe?"
        message="Are you sure you want to delete this recipe?"
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );
}

function IngredientsTab() {
  const [data, setData] = useState<IngRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const limit = 20;

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', default_unit: '', standard_cost_per_unit: '', description: '' });

  const load = useCallback(() => {
    setLoading(true);
    let url = `/api/hpp/ingredients?limit=${limit}&page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d.data ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  const handleOpenAdd = () => {
    setEditId(null);
    setForm({ name: '', default_unit: '', standard_cost_per_unit: '', description: '' });
    setModalOpen(true);
  };

  const handleOpenEdit = (row: IngRow) => {
    setEditId(row.id);
    setForm({
      name: row.name,
      default_unit: row.default_unit || '',
      standard_cost_per_unit: row.standard_cost_per_unit ? String(row.standard_cost_per_unit) : '',
      description: row.description || ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return alert('Name is required');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        default_unit: form.default_unit,
        standard_cost_per_unit: Number(form.standard_cost_per_unit) || 0,
        description: form.description
      };
      const res = await fetch(editId ? `/api/hpp/ingredients/${editId}` : '/api/hpp/ingredients', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save');
      setModalOpen(false);
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/hpp/ingredients/${deleteConfirm}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete');
      }
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div style={{ display: 'flex', gap: 12, padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
        <input className="input" placeholder="Search ingredient name..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
        <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{total} ingredients</span>
        <button className="btn btn-primary" onClick={handleOpenAdd}>+ Add Ingredient</button>
      </div>

      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading data...</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Ingredient Name</th>
                <th>Unit</th>
                <th className="right">Standard Cost/Unit</th>
                <th className="right">Used in Recipes</th>
                <th>Description</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 600 }}>{row.name}</td>
                  <td><span style={{ fontSize: 13 }}>{row.default_unit ?? '—'}</span></td>
                  <td className="right ">{rp(row.standard_cost_per_unit)}</td>
                  <td className="right">
                    <span style={{
                      background: row.used_in_recipes > 10 ? '#dcfce7' : '#f1f5f9',
                      color: row.used_in_recipes > 10 ? '#166534' : 'var(--muted)',
                      padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                    }}>
                      {row.used_in_recipes}
                    </span>
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{row.description ?? '—'}</td>
                  <td className="right">
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                      <button className="btn" style={{ padding: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 6 }} onClick={() => handleOpenEdit(row)}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn" style={{ padding: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 6 }} onClick={() => setDeleteConfirm(row.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={16} />
          </button>
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Hal. {page} dari {totalPages}</span>
          <button className="btn" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Modal Add/Edit */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyItems: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{ background: '#f1f5f9', padding: 8, borderRadius: 8, color: 'var(--foreground)', display: 'flex' }}>
                  <Package size={20} />
                </div>
                <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>{editId ? 'Edit Ingredient' : 'New Ingredient'}</h2>
              </div>
              <button className="btn" style={{ border: 'none', padding: 6, color: 'var(--muted)', display: 'flex' }} onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body form-grid" style={{ padding: '24px', gap: 20 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <Input label="Ingredient Name" placeholder="e.g. Arabica Coffee Beans" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <Input label="Default Unit" placeholder="e.g. gr, ml, pcs" value={form.default_unit} onChange={e => setForm(f => ({ ...f, default_unit: e.target.value }))} />
              <Input label="Standard Cost / Unit" placeholder="Rp 0" type="number" min="0" step="1" required value={form.standard_cost_per_unit} onChange={e => setForm(f => ({ ...f, standard_cost_per_unit: e.target.value }))} />
              
              <div style={{ gridColumn: '1 / -1' }} className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea className="input" rows={3} placeholder="Add any notes about pricing or unit conversion here..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            
            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn" style={{ padding: '8px 16px', fontWeight: 600, background: '#fff', border: '1px solid var(--border)' }} onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ padding: '8px 24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }} onClick={handleSave} disabled={saving}>
                {saving ? null : <Save size={16} />}
                {saving ? 'Saving...' : 'Save Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Ingredient?"
        message="Are you sure you want to delete this ingredient?"
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );
}

function KitchenTab() {
  const [data, setData] = useState<KitchenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/hpp/recipes?tab=kitchen')
      .then(r => r.json())
      .then(d => setData(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter
    ? data.filter(r => r.source_sheet === filter)
    : data;

  return (
    <>
      <div style={{ display: 'flex', gap: 12, padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
        <select className="input" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">Kitchen + Turangga</option>
          <option value="Kitchen 2025">Kitchen 2025</option>
          <option value="Turangga">Turangga</option>
        </select>
        <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{filtered.length} recipes</span>
      </div>
      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading data...</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Recipe Name</th>
                <th>Sheet</th>
                <th className="right">Yield</th>
                <th className="right">Raw Cost</th>
                <th className="right">COGS (+10%)</th>
                <th className="right">Cost/Unit Yield</th>
                <th className="right">Sale Price</th>
                <th className="right">COGS %</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{row.recipe_name}</td>
                  <td><span style={{ fontSize: 12, color: 'var(--muted)', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{row.source_sheet}</span></td>
                  <td className="right ">{Number(row.yield_amount).toLocaleString('id-ID')} <span className="muted">{row.yield_unit}</span></td>
                  <td className="right ">{rp(row.raw_cost)}</td>
                  <td className="right " style={{ fontWeight: 700, color: '#016e3f' }}>{rp(row.total_cost_with_xfactor)}</td>
                  <td className="right ">{rp(row.cost_per_unit_yield)}</td>
                  <td className="right ">{row.sale_price > 0 ? rp(row.sale_price) : <span className="muted">Base Prep</span>}</td>
                  <td className="right " style={{ color: row.hpp_ratio_pct && row.hpp_ratio_pct > 50 ? '#dc2626' : row.hpp_ratio_pct && row.hpp_ratio_pct > 35 ? '#d97706' : '#166534' }}>
                    {row.hpp_ratio_pct != null ? `${row.hpp_ratio_pct}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function HppPage() {
  const [tab, setTab] = useState<'menus' | 'recipes' | 'ingredients' | 'kitchen'>('menus');
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);

  useEffect(() => {
    fetch('/api/hpp/stats').then(r => r.json()).then(setStats);
    fetch('/api/hpp').then(r => r.json()).then(d => {
      setCategories(d.categories ?? []);
      setVenues(d.venues ?? []);
    });
  }, []);

  const tabDefs = [
    { key: 'menus', label: 'POS Menus' },
    { key: 'recipes', label: 'Recipe Cards' },
    { key: 'ingredients', label: 'Ingredients' },
    { key: 'kitchen', label: 'Kitchen & Turangga' },
  ] as const;

  const marginMap = (stats?.marginBreakdown ?? []).reduce((a, b) => ({ ...a, [b.flag]: b.count }), {} as Record<string, number>);

  return (
    <section className="screen">
      {/* Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <h3>COGS & Recipes</h3>
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {[
              { label: 'Total POS Menus', value: stats.totalMenus, iconColor: '#475569', icon: Calculator },
              { label: 'Total Recipes', value: stats.totalRecipes, iconColor: '#475569', icon: FileText },
              { label: 'Ingredients', value: stats.totalIngredients, iconColor: '#475569', icon: PackageSearch },
              { label: 'Green Margin', value: marginMap['GREEN'] ?? 0, iconColor: '#15803d', icon: CheckCircle2 },
              { label: 'Yellow Margin', value: marginMap['YELLOW'] ?? 0, iconColor: '#a16207', icon: AlertCircle },
              { label: 'Red Margin', value: marginMap['RED'] ?? 0, iconColor: '#b91c1c', icon: XCircle },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} style={{
                  flex: '1 1 150px', padding: '16px 20px', borderRight: i < 5 ? '1px solid var(--border)' : 'none',
                  borderBottom: i < 3 ? '1px solid var(--border)' : 'none', // For wrap
                  display: 'flex', flexDirection: 'column', gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={16} strokeWidth={2.5} style={{ color: s.iconColor }} />
                    <div className="muted" style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>{s.label}</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)' }}>{s.value}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Venue row */}
        {stats?.byVenue && (
          <div style={{ display: 'flex', gap: 16, padding: '12px 20px', borderTop: '1px solid var(--border)', background: '#f8fafc' }}>
            {stats.byVenue.map(v => (
              <div key={v.venue} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  background: '#016e3f', color: '#ffffff',
                  padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                }}>{v.venue}</span>
                <span className="muted" style={{ fontSize: 12 }}>{v.count} recipes</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="card">
        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 0 }}>
          {tabDefs.map(t => (
            <button
              key={t.key}
              className={`tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'menus' && <MenusTab categories={categories} />}
        {tab === 'recipes' && <RecipesTab venues={venues} />}
        {tab === 'ingredients' && <IngredientsTab />}
        {tab === 'kitchen' && <KitchenTab />}
      </div>
    </section>
  );
}

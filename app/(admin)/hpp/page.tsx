'use client';
import { useState, useEffect, useCallback } from 'react';
import { Table } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';

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

import { CheckCircle2, AlertCircle, XCircle, Calculator, PackageSearch, FileText, ChevronLeft, ChevronRight, X, Pencil, Trash2, Package, Save, Eye } from 'lucide-react';

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

  const [detailModal, setDetailModal] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newPrice, setNewPrice] = useState<string>('');

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

  const openDetail = async (menuId: number) => {
    setDetailModal(menuId);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetch(`/api/hpp/menus/${menuId}`);
      if (res.ok) {
        const d = await res.json();
        setDetailData(d);
        setNewPrice(d.menu.sale_price ? Math.round(Number(d.menu.sale_price)).toString() : '0');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSavePrice = async () => {
    if (!detailModal || !detailData) return;
    const sale_price = parseFloat(newPrice);
    if (isNaN(sale_price) || sale_price < 0) return alert('Nominal harga tidak valid');

    try {
      const res = await fetch(`/api/hpp/menus/${detailModal}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale_price })
      });
      if (res.ok) {
        setDetailModal(null);
        load();
      } else {
        const err = await res.json();
        alert('Gagal: ' + (err.error || 'Unknown error'));
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <>


      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input" placeholder="Cari nama menu..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ width: 220 }}
        />
        <Select
          value={catId}
          onChange={val => { setCatId(val); setPage(1); }}
          options={[
            { value: '', label: 'Semua Kategori' },
            ...categories.map(c => ({ value: String(c.id), label: c.name }))
          ]}
          style={{ width: 180 }}
          inputStyle={{ height: 32 }}
        />
        <Select
          value={marginFlag}
          onChange={val => { setMarginFlag(val); setPage(1); }}
          options={[
            { value: '', label: 'Semua Margin' },
            { value: 'GREEN', label: 'Hijau (<35%)' },
            { value: 'YELLOW', label: 'Kuning (35–50%)' },
            { value: 'RED', label: 'Merah (>50%)' }
          ]}
          style={{ width: 150 }}
          inputStyle={{ height: 32 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <span className="muted" style={{ fontSize: 13 }}>
            {total} Menu ditemukan
          </span>
          <div 
            className="group" 
            style={{ position: 'relative', cursor: 'help', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
          >
            <AlertCircle size={18} />
            <div 
              className="hidden group-hover:flex" 
              style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 50,
                background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 12, width: 230,
                flexDirection: 'column', gap: 8
              }}
            >
              <span className="font-bold" style={{ fontSize: 13, marginBottom: 4, color: '#12201a' }}>Indikator % HPP</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }}></span>
                <span className="muted"><strong>Hijau</strong> (&lt; 35% - Sehat)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#eab308' }}></span>
                <span className="muted"><strong>Kuning</strong> (35–50% - Peringatan)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }}></span>
                <span className="muted"><strong>Merah</strong> (&gt; 50% - Kritis)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <p className="muted">Tidak ada data yang sesuai filter.</p>
          </div>
        ) : (
          <div className="table-responsive">
          <Table>
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Menu / Varian</th>
                <th className="right">Harga Jual</th>
                <th className="right">HPP</th>
                <th className="right">Laba Kotor</th>
                <th className="right">% HPP</th>
                <th className="right">% Margin</th>
                <th className="center">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id} onClick={() => openDetail(row.id)} style={{ cursor: 'pointer' }}>
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
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={16} />
          </button>
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Halaman {page} dari {totalPages}</span>
          <button className="btn" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <Modal isOpen={!!detailModal} onClose={() => setDetailModal(null)} title="Detail Menu & HPP" maxWidth={680}>
        {detailLoading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--muted)' }}>Memuat detail...</div>
        ) : detailData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0 4px' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{detailData.menu.display_name ?? detailData.menu.name}</div>
                {detailData.menu.variant && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{detailData.menu.variant}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Biaya Dasar</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{rp(detailData.menu.hpp)}</div>
              </div>
            </div>



            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Komposisi Bahan Baku <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12 }}>(Hanya Baca)</span></div>
              {detailData.ingredients?.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Tidak ada resep yang tertaut ke menu ini.
                </div>
              ) : (
                <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                  <Table>
                    <thead>
                      <tr>
                        <th>Bahan Baku</th>
                        <th className="right">Jml</th>
                        <th className="center">Satuan</th>
                        <th className="right">Harga/Satuan</th>
                        <th className="right">Total Biaya</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.ingredients.map((ing: any) => (
                        <tr key={ing.id}>
                          <td style={{ fontWeight: 500 }}>{ing.ingredient_name}</td>
                          <td className="right">{Number(ing.qty).toLocaleString('id-ID')}</td>
                          <td className="center" style={{ color: 'var(--muted)', fontSize: 12 }}>{ing.unit}</td>
                          <td className="right" style={{ color: 'var(--muted)' }}>{Math.round(ing.cost_per_unit || 0).toLocaleString('id-ID')}</td>
                          <td className="right" style={{ fontWeight: 600 }}>{Math.round(ing.cost || 0).toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid var(--border)' }}>
                        <td colSpan={3} style={{ padding: '10px 14px', fontSize: 13 }}></td>
                        <td className="right" style={{ fontWeight: 600, fontSize: 13, padding: '10px 14px' }}>Total Biaya Bahan Baku</td>
                        <td className="right" style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, padding: '10px 14px' }}>
                          {Math.round(detailData.ingredients.reduce((sum: number, i: any) => sum + Number(i.cost || 0), 0)).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: 'red' }}>Gagal memuat data.</div>
        )}
      </Modal>
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

  const [viewRecipeModal, setViewRecipeModal] = useState<number | null>(null);
  const [viewRecipeData, setViewRecipeData] = useState<any>(null);
  const [viewRecipeLoading, setViewRecipeLoading] = useState(false);

  const SHEETS = ['Bar 1', 'Bar 2', 'Kitchen 2025'];

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

  const openViewRecipe = async (id: number) => {
    setViewRecipeModal(id);
    setViewRecipeLoading(true);
    setViewRecipeData(null);
    try {
      const res = await fetch(`/api/hpp/recipes/${id}`);
      if (res.ok) setViewRecipeData(await res.json());
    } finally {
      setViewRecipeLoading(false);
    }
  };

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
        <input className="input" placeholder="Cari nama resep..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: 220 }} />
        <Select
          value={venueId}
          onChange={val => { setVenueId(val); setPage(1); }}
          options={[
            { value: '', label: 'Semua Venue' },
            ...venues.map(v => ({ value: String(v.id), label: v.name }))
          ]}
          style={{ width: 150 }}
          inputStyle={{ height: 32 }}
        />
        <Select
          value={sheet}
          onChange={val => { setSheet(val); setPage(1); }}
          options={[
            { value: '', label: 'Semua Sheet' },
            ...SHEETS.map(s => ({ value: s, label: s }))
          ]}
          style={{ width: 160 }}
          inputStyle={{ height: 32 }}
        />
        <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{total} resep</span>
        <a href="/hpp/recipe-builder/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>+ Tambah Resep</a>
      </div>

      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
        ) : (
          <div className="table-responsive">
          <Table>
            <thead>
              <tr>
                <th>Nama Resep</th>
                <th>Venue / Sheet</th>
                <th className="right">Yield (Hasil)</th>
                <th className="right">Subtotal Bahan</th>
                <th className="right">Total HPP</th>
                <th className="right">Harga Jual</th>
                <th className="right" style={{ width: 120 }}>Aksi</th>
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
                  <td className="right ">{row.sale_price ? rp(row.sale_price) : <span className="muted">Persiapan Dasar</span>}</td>
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
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={16} />
          </button>
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Halaman {page} dari {totalPages}</span>
          <button className="btn" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Hapus Resep?"
        message="Apakah Anda yakin ingin menghapus resep ini?"
        confirmText="Hapus"
        cancelText="Batal"
        danger={true}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      <Modal isOpen={!!viewRecipeModal} onClose={() => setViewRecipeModal(null)} title="Detail Resep" maxWidth={680}>
        {viewRecipeLoading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--muted)' }}>Memuat resep...</div>
        ) : viewRecipeData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0 4px' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{viewRecipeData.recipe.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                  {viewRecipeData.recipe.venue_name} &middot; {viewRecipeData.recipe.source_sheet}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yield</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
                  {Number(viewRecipeData.recipe.yield).toLocaleString('id-ID')} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>{viewRecipeData.recipe.yield_unit ?? 'pcs'}</span>
                </div>
              </div>
            </div>

            <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
              <Table>
                <thead>
                  <tr>
                    <th>Bahan Baku</th>
                    <th className="right">Jml</th>
                    <th className="center">Satuan</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewRecipeData.ingredients || []).map((ing: any) => (
                    <tr key={ing.id}>
                      <td style={{ fontWeight: 500 }}>{ing.ingredient_name}</td>
                      <td className="right">{Number(ing.quantity).toLocaleString('id-ID')}</td>
                      <td className="center" style={{ color: 'var(--muted)', fontSize: 12 }}>{ing.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: 'red' }}>Gagal memuat resep.</div>
        )}
      </Modal>
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
      standard_cost_per_unit: row.standard_cost_per_unit != null ? String(Number(row.standard_cost_per_unit)) : '',
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
        <input className="input" placeholder="Cari nama bahan baku..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
        <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{total} bahan baku</span>
        <button className="btn btn-primary" onClick={handleOpenAdd}>+ Tambah Bahan Baku</button>
      </div>

      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
        ) : (
          <div className="table-responsive">
          <Table>
            <thead>
              <tr>
                <th>Nama Bahan Baku</th>
                <th>Satuan</th>
                <th className="right">Biaya Standar/Satuan</th>
                <th className="right">Digunakan di Resep</th>
                <th>Deskripsi</th>
                <th className="right">Aksi</th>
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
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={16} />
          </button>
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Halaman {page} dari {totalPages}</span>
          <button className="btn" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyItems: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{ background: '#f1f5f9', padding: 8, borderRadius: 8, color: 'var(--foreground)', display: 'flex' }}>
                  <Package size={20} />
                </div>
                <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>{editId ? 'Edit Bahan Baku' : 'Bahan Baku Baru'}</h2>
              </div>
              <button className="btn" style={{ border: 'none', padding: 6, color: 'var(--muted)', display: 'flex' }} onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body form-grid" style={{ padding: '24px', gap: 20 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <Input label="Nama Bahan Baku" placeholder="misal: Biji Kopi Arabika" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <Input label="Satuan Default" placeholder="misal: gr, ml, pcs" value={form.default_unit} onChange={e => setForm(f => ({ ...f, default_unit: e.target.value }))} />
              <Input label="Biaya Standar / Satuan" placeholder="Rp 0" type="number" min="0" step="1" required value={form.standard_cost_per_unit} onChange={e => setForm(f => ({ ...f, standard_cost_per_unit: e.target.value }))} />
              
              <div style={{ gridColumn: '1 / -1' }} className="form-group">
                <label className="form-label">Deskripsi (Opsional)</label>
                <textarea className="input" rows={3} placeholder="Tambahkan catatan tentang harga atau konversi satuan di sini..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            
            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn" style={{ padding: '8px 16px', fontWeight: 600, background: '#fff', border: '1px solid var(--border)' }} onClick={() => setModalOpen(false)}>Batal</button>
              <button className="btn btn-primary" style={{ padding: '8px 24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }} onClick={handleSave} disabled={saving}>
                {saving ? null : <Save size={16} />}
                {saving ? 'Menyimpan...' : 'Simpan Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Hapus Bahan Baku?"
        message="Apakah Anda yakin ingin menghapus bahan baku ini?"
        confirmText="Hapus"
        cancelText="Batal"
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
        <Select
          value={filter}
          onChange={val => setFilter(val)}
          options={[
            { value: '', label: 'Semua Kitchen' },
            { value: 'Kitchen 2025', label: 'Kitchen 2025' }
          ]}
          style={{ width: 180 }}
          inputStyle={{ height: 32 }}
        />
        <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{filtered.length} resep</span>
      </div>
      <div className="card-body flush">
        {loading ? (
          <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
        ) : (
          <div className="table-responsive">
          <Table>
            <thead>
              <tr>
                <th>Nama Resep</th>
                <th>Sheet</th>
                <th className="right">Yield (Hasil)</th>
                <th className="right">Biaya Bahan Baku</th>
                <th className="right">HPP (+10%)</th>
                <th className="right">Biaya/Satuan Yield</th>
                <th className="right">Harga Jual</th>
                <th className="right">% HPP</th>
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
                  <td className="right ">{row.sale_price > 0 ? rp(row.sale_price) : <span className="muted">Persiapan Dasar</span>}</td>
                  <td className="right " style={{ color: row.hpp_ratio_pct && row.hpp_ratio_pct > 50 ? '#dc2626' : row.hpp_ratio_pct && row.hpp_ratio_pct > 35 ? '#d97706' : '#166534' }}>
                    {row.hpp_ratio_pct != null ? `${row.hpp_ratio_pct}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          </div>
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
    { key: 'menus', label: 'Menu POS' },
    { key: 'recipes', label: 'Kartu Resep' },
    { key: 'ingredients', label: 'Bahan Baku' },
    { key: 'kitchen', label: 'Kitchen' },
  ] as const;

  const marginMap = (stats?.marginBreakdown ?? []).reduce((a, b) => ({ ...a, [b.flag]: b.count }), {} as Record<string, number>);

  return (
    <section className="screen">
      {/* Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <h3>HPP & Resep</h3>
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {[
              { label: 'Total Menu POS', value: stats.totalMenus, iconColor: '#475569', icon: Calculator },
              { label: 'Total Resep', value: stats.totalRecipes, iconColor: '#475569', icon: FileText },
              { label: 'Bahan Baku', value: stats.totalIngredients, iconColor: '#475569', icon: PackageSearch },
              { label: 'Margin Hijau', value: marginMap['GREEN'] ?? 0, iconColor: '#15803d', icon: CheckCircle2 },
              { label: 'Margin Kuning', value: marginMap['YELLOW'] ?? 0, iconColor: '#a16207', icon: AlertCircle },
              { label: 'Margin Merah', value: marginMap['RED'] ?? 0, iconColor: '#b91c1c', icon: XCircle },
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
                <span className="muted" style={{ fontSize: 12 }}>{v.count} resep</span>
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

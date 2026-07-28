'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Toast } from '@/components/ui/Toast';
import { RefreshCcw, Search, Truck, Info, Calendar, DollarSign, ChevronRight, X, Package, ShoppingCart, ClipboardList, BarChart2 } from 'lucide-react';
import { CombinedStockView } from './CombinedStockView';

interface Outlet { 
  id: number; 
  name: string; 
  last_request_date?: string | null;
  last_do_date?: string | null;
  last_sales_sync?: string | null;
}
interface Category { id: number; name: string; }
interface Item { id: number; name: string; sku: string; category_id: number; minimum_threshold: number; smallest_unit: string; central_stock: number; conversion_ratio: number; purchase_unit?: string; }
interface ConsumedMaterial {
  item_id: number;
  item_name: string;
  smallest_unit: string;
  purchase_unit: string;
  conversion_ratio: number;
  total_consumed_smallest: number;
  consumed_display: string;
}
interface SoldProduct {
  name: string;
  category_name: string;
  item_sold: number;
  net_sales: number;
}
interface OutletConsumptionSummary {
  outlet_id: number;
  last_do_date: string | null;
  last_request_date: string | null;
  total_revenue: number;
  total_qty_sold: number;
  consumed_materials: ConsumedMaterial[];
  sold_products: SoldProduct[];
  period_start_date: string;
}

export default function StockMonitoringPage() {
  const router = useRouter();
  const [data, setData] = useState<{
    outlets: Outlet[];
    items: Item[];
    stockMatrix: Record<number, Record<number, number>>;
    categories: Category[];
    consumptionMap?: Record<number, OutletConsumptionSummary>;
  } | null>(null);
  
  const [activeTab, setActiveTab] = useState<'PER_OUTLET' | 'GABUNGAN' | 'AKTIVITAS'>('AKTIVITAS');
  const [materialModal, setMaterialModal] = useState<{ outletName: string; materials: ConsumedMaterial[]; sinceDate: string } | null>(null);
  const [productModal, setProductModal] = useState<{ outletName: string; products: SoldProduct[]; sinceDate: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutlet, setFilterOutlet] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, KRITIS, AMAN
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [showLegendTooltip, setShowLegendTooltip] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/outlet-monitoring');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error(err);
      setToast({ open: true, message: 'Gagal mengambil data matriks stok', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatUnit = (unit: string) => {
    if (!unit) return '';
    if (unit.toLowerCase() === 'l') return 'Liter';
    return unit;
  };

  const formatQty = (rawQty: number, conversionRatio: number = 1) => {
    const qty = rawQty / (conversionRatio || 1);
    return qty.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  };

  const getStatus = (qty: number, minStock: number | null) => {
    if (!minStock || minStock === 0) return 'AMAN'; // if no limit set, assume safe
    if (qty <= minStock) return 'KRITIS';
    if (qty <= minStock * 1.5) return 'MENIPIS';
    return 'AMAN';
  };

  // Filter Items
  const filteredItems = data?.items.filter((item: Item) => {
    const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchSearch) return false;
    if (filterCategory !== 'ALL' && item.category_id !== Number(filterCategory)) return false;
    
    // Check outlet usage
    if (filterOutlet !== 'ALL') {
      // Show all items, just treat as 0 if not exist
    }
    
    if (filterStatus === 'ALL') return true;

    // Status filter
    let hasStatus = false;
    const outletsToCheck = filterOutlet === 'ALL' 
      ? data.outlets 
      : data.outlets.filter((o: Outlet) => o.id === Number(filterOutlet));
      
    for (const outlet of outletsToCheck) {
      const qty = data.stockMatrix[item.id]?.[outlet.id] ?? 0;
      const status = getStatus(qty, item.minimum_threshold);
      if (filterStatus === 'KRITIS' && (status === 'KRITIS' || status === 'MENIPIS')) {
        hasStatus = true;
        break;
      }
      if (filterStatus === 'AMAN' && status === 'AMAN') {
        hasStatus = true;
        break;
      }
    }
    
    return hasStatus;
  });

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterCategory, filterOutlet]);

  const visibleOutlets = filterOutlet === 'ALL' 
    ? (data?.outlets || []) 
    : (data?.outlets?.filter((o: Outlet) => o.id === Number(filterOutlet)) || []);

  const totalItems = filteredItems?.length || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedItems = filteredItems?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const selectedOutletObj = filterOutlet !== 'ALL' ? data?.outlets?.find(o => o.id === Number(filterOutlet)) : undefined;
  const selectedSummary = selectedOutletObj ? data?.consumptionMap?.[selectedOutletObj.id] : undefined;

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head" style={{ padding: '16px 20px', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="text-gray-900" style={{ fontSize: '15px', margin: 0 }}>
              {activeTab === 'GABUNGAN' ? 'Laporan Stok Gabungan' : 'Pemantauan Stok'}
            </h3>
            <p className="text-gray-500 mt-1" style={{ fontSize: '12px', margin: '4px 0 0 0' }}>
              {activeTab === 'GABUNGAN' 
                ? 'Rekapitulasi stok keseluruhan di seluruh lokasi.' 
                : activeTab === 'AKTIVITAS'
                ? 'Pantau aktivitas pengadaan, penjualan & konsumsi bahan setiap outlet sejak DO terakhir.'
                : 'Pantau ketersediaan stok fisik secara live di seluruh cabang dan pusat.'}
            </p>
          </div>
          <div style={{ visibility: loading ? 'visible' : 'hidden', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
            {loading && (
              <>
                <RefreshCcw size={14} className="spin" />
                Memuat data real-time...
              </>
            )}
          </div>
        </div>

        <div className="tabs" style={{ marginBottom: 0, padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
          <button 
            onClick={() => setActiveTab('AKTIVITAS')}
            style={{ cursor: 'pointer', background: 'none', border: 'none', borderBottom: activeTab === 'AKTIVITAS' ? '2px solid var(--primary)' : '2px solid transparent', padding: '10px 14px', fontSize: 13, fontWeight: activeTab === 'AKTIVITAS' ? 600 : 500, color: activeTab === 'AKTIVITAS' ? 'var(--primary)' : 'var(--muted)' }}
          >
            Aktivitas Outlet
          </button>
          <button 
            onClick={() => setActiveTab('PER_OUTLET')}
            style={{ cursor: 'pointer', background: 'none', border: 'none', borderBottom: activeTab === 'PER_OUTLET' ? '2px solid var(--primary)' : '2px solid transparent', padding: '10px 14px', fontSize: 13, fontWeight: activeTab === 'PER_OUTLET' ? 600 : 500, color: activeTab === 'PER_OUTLET' ? 'var(--primary)' : 'var(--muted)' }}
          >
            Matriks Stok
          </button>
          <button 
            onClick={() => setActiveTab('GABUNGAN')}
            style={{ cursor: 'pointer', background: 'none', border: 'none', borderBottom: activeTab === 'GABUNGAN' ? '2px solid var(--primary)' : '2px solid transparent', padding: '10px 14px', fontSize: 13, fontWeight: activeTab === 'GABUNGAN' ? 600 : 500, color: activeTab === 'GABUNGAN' ? 'var(--primary)' : 'var(--muted)' }}
          >
            Total Gabungan
          </button>
        </div>

      {activeTab === 'GABUNGAN' ? (
        <CombinedStockView categories={data?.categories || []} />
      ) : activeTab === 'AKTIVITAS' ? (
        <>
          <div style={{ padding: '20px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <RefreshCcw size={20} className="spin" style={{ color: '#016e3f' }} />
                Memuat aktivitas outlet...
              </div>
            ) : !data || !data.consumptionMap ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#ef4444', fontSize: 13 }}>Gagal memuat data aktivitas.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {data.outlets.map(outlet => {
                  const s = data.consumptionMap![outlet.id];
                  const daysSinceDO = outlet.last_do_date
                    ? Math.floor((Date.now() - new Date(outlet.last_do_date).getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  const isLate = daysSinceDO !== null && daysSinceDO > 14;
                  const hasMaterials = s?.consumed_materials && s.consumed_materials.length > 0;
                  return (
                    <div key={outlet.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      {/* Card Header */}
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{outlet.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <ShoppingCart size={10} />
                            Sync: {outlet.last_sales_sync ? new Date(outlet.last_sales_sync).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Belum pernah'}
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/delivery-orders/create?order_id=DIRECT&outlet_id=${outlet.id}`)}
                          style={{ fontSize: 11, fontWeight: 600, color: '#016e3f', background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <Truck size={11} />
                          Kirim DO
                        </button>
                      </div>

                      {/* Stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ padding: '12px 16px', borderRight: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            <Calendar size={10} />
                            DO Terakhir
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isLate ? '#dc2626' : '#0f172a', lineHeight: 1.3 }}>
                            {outlet.last_do_date
                              ? new Date(outlet.last_do_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '—'}
                          </div>
                          <div style={{ fontSize: 10, color: isLate ? '#dc2626' : '#94a3b8', marginTop: 2 }}>
                            {daysSinceDO !== null ? `${daysSinceDO} hari lalu` : 'Belum pernah'}
                          </div>
                        </div>
                        <div style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            <DollarSign size={10} />
                            Penjualan
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                            Rp {(s?.total_revenue || 0).toLocaleString('id-ID')}
                          </div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                            {s?.total_qty_sold || 0} porsi
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Materials + Products */}
                      <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {/* Bahan dihabiskan */}
                        <button
                          onClick={() => hasMaterials && setMaterialModal({
                            outletName: outlet.name,
                            materials: s!.consumed_materials,
                            sinceDate: s!.period_start_date
                          })}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: hasMaterials ? 'pointer' : 'default' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: hasMaterials ? '#475569' : '#94a3b8' }}>
                            <Package size={12} style={{ color: hasMaterials ? '#016e3f' : '#94a3b8' }} />
                            <span>{hasMaterials ? `${s!.consumed_materials.length} bahan dihabiskan` : 'Belum ada data konsumsi'}</span>
                          </div>
                          {hasMaterials && <ChevronRight size={13} style={{ color: '#94a3b8' }} />}
                        </button>

                        {/* Produk terjual */}
                        {(() => {
                          const hasProducts = s?.sold_products && s.sold_products.length > 0;
                          return (
                            <button
                              onClick={() => hasProducts && setProductModal({
                                outletName: outlet.name,
                                products: s!.sold_products,
                                sinceDate: s!.period_start_date
                              })}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: hasProducts ? 'pointer' : 'default' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: hasProducts ? '#475569' : '#94a3b8' }}>
                                <BarChart2 size={12} style={{ color: hasProducts ? '#2563eb' : '#94a3b8' }} />
                                <span>{hasProducts ? `${s!.sold_products.length} produk terjual` : 'Belum ada data penjualan'}</span>
                              </div>
                              {hasProducts && <ChevronRight size={13} style={{ color: '#94a3b8' }} />}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Detail Bahan */}
          {materialModal && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(2px)' }}
              onClick={() => setMaterialModal(null)}
            >
              <div
                style={{ background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', border: '1px solid #e2e8f0' }}
                onClick={e => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>{materialModal.outletName}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Calendar size={12} style={{ color: '#016e3f' }} />
                      <span>Sejak {new Date(materialModal.sinceDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      <span style={{ color: '#cbd5e1' }}>•</span>
                      <span style={{ color: '#016e3f', fontWeight: 600 }}>Auto-deduct Moka</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setMaterialModal(null)}
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', color: '#64748b', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Fixed Column Header Bar */}
                <div style={{ padding: '9px 22px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Package size={13} />
                    Bahan Baku Terpakai
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Jumlah
                  </div>
                </div>

                {/* Scrollable Materials List */}
                <div style={{ overflowY: 'auto', maxHeight: '52vh', padding: '0 22px' }}>
                  {materialModal.materials.map((m, idx) => (
                    <div
                      key={m.item_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: idx < materialModal.materials.length - 1 ? '1px solid #f1f5f9' : 'none'
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>
                        {m.item_name}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '4px 10px', borderRadius: 6 }}>
                        {m.consumed_display}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Modal Footer */}
                <div style={{ padding: '12px 22px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                    Total <strong style={{ color: '#0f172a' }}>{materialModal.materials.length} jenis</strong> bahan dihabiskan
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Produk Terjual */}
          {productModal && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(2px)' }}
              onClick={() => setProductModal(null)}
            >
              <div
                style={{ background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', border: '1px solid #e2e8f0', maxHeight: '85vh' }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>{productModal.outletName}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Calendar size={12} style={{ color: '#2563eb' }} />
                      <span>Sejak {new Date(productModal.sinceDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      <span style={{ color: '#cbd5e1' }}>•</span>
                      <span style={{ color: '#2563eb', fontWeight: 600 }}>Data Moka POS</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setProductModal(null)}
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', color: '#64748b', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Column Header */}
                <div style={{ padding: '9px 22px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BarChart2 size={13} />
                    Produk Terjual
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Porsi
                  </div>
                </div>

                {/* Scrollable Product List */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '0 22px' }}>
                  {productModal.products.map((p, idx) => (
                    <div
                      key={`${p.name}-${idx}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '11px 0',
                        borderBottom: idx < productModal.products.length - 1 ? '1px solid #f1f5f9' : 'none'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                          {p.category_name} · Rp {p.net_sales.toLocaleString('id-ID')}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', background: '#eff6ff', padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                        {p.item_sold} porsi
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 22px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                    Total <strong style={{ color: '#0f172a' }}>{productModal.products.length} produk</strong> terjual · Total <strong style={{ color: '#0f172a' }}>Rp {productModal.products.reduce((a, p) => a + p.net_sales, 0).toLocaleString('id-ID')}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
      <div className="card-body p-0">
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div className="text-gray-500 font-medium" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            Matriks Stok Per Outlet
            <div 
              onMouseEnter={() => setShowLegendTooltip(true)}
              onMouseLeave={() => setShowLegendTooltip(false)}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <Info size={14} style={{ cursor: 'help', color: '#94a3b8' }} />
              {showLegendTooltip && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 6,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  padding: '10px 14px',
                  borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  zIndex: 50,
                  width: 260,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Panduan Warna Teks</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>100</span> Stok Aman
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155' }}>
                    <span style={{ fontWeight: 600, color: '#eab308' }}>20</span> Stok Menipis (Hampir Kritis)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155' }}>
                    <span style={{ fontWeight: 600, color: '#ef4444' }}>-5</span> Stok Kritis / Minus
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="text"
                className="input"
                placeholder="Cari barang/SKU..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: 180, padding: '6px 12px 6px 30px', fontSize: 12 }}
              />
            </div>
            <Select 
              value={filterOutlet}
              onChange={(val) => setFilterOutlet(String(val))}
              options={[
                { value: 'ALL', label: 'Semua Outlet' },
                ...(data?.outlets?.map((outlet: Outlet) => ({ value: outlet.id.toString(), label: outlet.name })) || [])
              ]}
              style={{ width: 160 }}
            />
            <Select 
              value={filterCategory}
              onChange={(val) => setFilterCategory(String(val))}
              options={[
                { value: 'ALL', label: 'Semua Kategori' },
                ...(data?.categories?.map((cat: { id: number, name: string }) => ({ value: cat.id.toString(), label: cat.name })) || [])
              ]}
              style={{ width: 160 }}
            />
            <Select 
              value={filterStatus}
              onChange={(val) => setFilterStatus(String(val))}
              options={[
                { value: 'ALL', label: 'Semua Kondisi' },
                { value: 'KRITIS', label: 'Stok Kritis/Menipis' },
                { value: 'AMAN', label: 'Stok Aman' }
              ]}
              style={{ width: 160 }}
            />
          </div>
        </div>

        {/* Panel Intelijen Stok & Konsumsi Outlet */}
        {selectedOutletObj ? (
          <div style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', padding: '14px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{selectedOutletObj.name}</span>
                <span style={{ fontSize: 11, background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                  Konsumsi Pasca-DO
                </span>
              </div>
              <button
                onClick={() => router.push(`/delivery-orders/create?order_id=DIRECT&outlet_id=${selectedOutletObj.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#016e3f] text-white rounded-md hover:bg-[#015832] transition-colors shadow-sm"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>+ Kirim DO</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <Calendar className="w-3.5 h-3.5 text-[#016e3f]" />
                  <span>DO TERAKHIR</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  {selectedOutletObj.last_do_date 
                    ? new Date(selectedOutletObj.last_do_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Belum ada DO'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                  Order: {selectedOutletObj.last_request_date ? new Date(selectedOutletObj.last_request_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <DollarSign className="w-3.5 h-3.5 text-[#016e3f]" />
                  <span>PENJUALAN MOKA</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  Rp {(selectedSummary?.total_revenue || 0).toLocaleString('id-ID')}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                  {selectedSummary?.total_qty_sold || 0} porsi menu
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', gridColumn: 'span 2 / auto' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Package size={14} style={{ color: '#64748b' }} />
                  <span>BAHAN DIHABISKAN (AUTO-DEDUCT MOKA)</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {selectedSummary?.consumed_materials && selectedSummary.consumed_materials.length > 0 ? (
                    selectedSummary.consumed_materials.map((m) => (
                      <span key={m.item_id} style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5 }}>
                        {m.item_name}: {m.consumed_display}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      Belum ada pemakaian bahan sejak DO terakhir.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569' }}>
              <Info className="w-3.5 h-3.5 text-[#016e3f]" />
              <span>Pilih outlet di filter untuk melihat analisis konsumsi bahan & penjualan pasca-pengiriman.</span>
            </div>
            <button
              onClick={() => router.push('/delivery-orders/create?order_id=DIRECT')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#016e3f] text-white rounded-md hover:bg-[#015832] transition-colors shadow-sm"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>+ Kirim DO</span>
            </button>
          </div>
        )}
        
        <div className="card-body flush">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Memuat matriks stok...</div>
          ) : !data ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Gagal memuat data.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table responsive={false}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 250, whiteSpace: 'nowrap' }}>Nama Barang</th>
                    <th className="right" style={{ minWidth: 120, background: '#f8fafc', whiteSpace: 'nowrap' }}>Gudang Pusat</th>
                    {visibleOutlets.map(outlet => {
                      // Singkat nama outlet (contoh: ER COFFEELAB BANDUNG -> ER Bandung)
                      // Handle typo seperti COFFELAB, COFFEE LAB, dan hapus koma
                      const shortName = outlet.name
                        .replace(/COFFE\s*E?\s*LAB/i, '')
                        .replace(/,/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                      return (
                        <th key={outlet.id} className="right" style={{ minWidth: 140, whiteSpace: 'nowrap' }}>{shortName}</th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems?.length === 0 ? (
                    <tr>
                      <td colSpan={visibleOutlets.length + 2} className="center muted">Tidak ada data ditemukan.</td>
                    </tr>
                  ) : (
                    paginatedItems?.map(item => (
                      <tr key={item.id} className="hover-row">
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                        </td>
                        
                        {/* Gudang Pusat */}
                        <td className="right" style={{ background: '#f8fafc', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {item.central_stock <= 0 ? (
                            <span style={{ color: '#ef4444' }}>Kosong</span>
                          ) : (
                            <span>{formatQty(item.central_stock, item.conversion_ratio)} <span style={{ fontSize: 12, color: '#64748b' }}>{formatUnit(item.purchase_unit || item.smallest_unit)}</span></span>
                          )}
                        </td>

                        {/* Tiap Outlet */}
                        {visibleOutlets.map(outlet => {
                          const qty = data.stockMatrix[item.id]?.[outlet.id] ?? 0;

                          const status = getStatus(qty, item.minimum_threshold);
                          let color = '#0f172a';
                          let dotColor = '#22c55e'; // Aman
                          let highlight = false;

                          if (status === 'KRITIS') {
                            color = '#ef4444';
                            dotColor = '#ef4444';
                            highlight = true;
                          } else if (status === 'MENIPIS') {
                            color = '#eab308';
                            dotColor = '#eab308';
                            highlight = true;
                          }

                          return (
                            <td key={outlet.id} className="right" style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 6,
                                cursor: highlight ? 'pointer' : 'default'
                              }}
                              onClick={() => {
                                if (highlight) {
                                  // Quick Action: Redirect to delivery order creation
                                  router.push(`/delivery-orders/create?outlet_id=${outlet.id}&item_id=${item.id}`);
                                }
                              }}
                              title={highlight ? "Klik untuk buat Draft Surat Jalan" : ""}
                              >
                                <span style={{ fontWeight: 600, color }}>{formatQty(qty, item.conversion_ratio)}</span>
                                <span style={{ fontSize: 12, color: '#64748b' }}>{formatUnit(item.purchase_unit || item.smallest_unit)}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </div>

        <Toast isOpen={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, open: false })} />
        
        {!loading && data && totalPages > 1 && (
          <div style={{ padding: '16px' }}>
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
      )}

      </div>
    </section>
  );
}

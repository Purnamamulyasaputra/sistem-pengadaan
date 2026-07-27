'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Toast } from '@/components/ui/Toast';
import { RefreshCcw, Search, Truck, Info } from 'lucide-react';
import { CombinedStockView } from './CombinedStockView';

interface Outlet { id: number; name: string; }
interface Category { id: number; name: string; }
interface Item { id: number; name: string; sku: string; category_id: number; minimum_threshold: number; smallest_unit: string; central_stock: number; conversion_ratio: number; purchase_unit?: string; }

export default function StockMonitoringPage() {
  const router = useRouter();
  const [data, setData] = useState<{
    outlets: Outlet[];
    items: Item[];
    stockMatrix: Record<number, Record<number, number>>;
    categories: Category[];
  } | null>(null);
  
  const [activeTab, setActiveTab] = useState<'PER_OUTLET' | 'GABUNGAN'>('PER_OUTLET');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutlet, setFilterOutlet] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, KRITIS, AMAN
  const [filterCategory, setFilterCategory] = useState('ALL');
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

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 8px' }}>Pemantauan Stok</h1>
          <p className="muted" style={{ margin: 0 }}>Pantau ketersediaan stok fisik secara live di seluruh cabang dan pusat.</p>
        </div>
        {activeTab === 'PER_OUTLET' && (
          <Button variant="primary" onClick={fetchData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCcw size={16} className={loading ? 'spin' : ''} />
            {loading ? 'Memuat Data...' : 'Refresh Data Stok'}
          </Button>
        )}
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button 
          className={`tab ${activeTab === 'PER_OUTLET' ? 'active' : ''}`} 
          onClick={() => setActiveTab('PER_OUTLET')}
          style={{ cursor: 'pointer', background: 'none', border: 'none', borderBottom: activeTab === 'PER_OUTLET' ? '2px solid var(--primary)' : '2px solid transparent', padding: '12px 16px', fontSize: 14, fontWeight: activeTab === 'PER_OUTLET' ? 600 : 500, color: activeTab === 'PER_OUTLET' ? 'var(--primary)' : 'var(--muted)' }}
        >
          Rincian Per Outlet
        </button>
        <button 
          className={`tab ${activeTab === 'GABUNGAN' ? 'active' : ''}`} 
          onClick={() => setActiveTab('GABUNGAN')}
          style={{ cursor: 'pointer', background: 'none', border: 'none', borderBottom: activeTab === 'GABUNGAN' ? '2px solid var(--primary)' : '2px solid transparent', padding: '12px 16px', fontSize: 14, fontWeight: activeTab === 'GABUNGAN' ? 600 : 500, color: activeTab === 'GABUNGAN' ? 'var(--primary)' : 'var(--muted)' }}
        >
          Total Keseluruhan (Pusat + Outlet)
        </button>
      </div>

      {activeTab === 'GABUNGAN' ? (
        <CombinedStockView />
      ) : (
      <>
      <div className="card" style={{ overflow: 'visible' }}>
        <div className="card-head" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }} />
            <Input 
              placeholder="Cari nama barang atau SKU..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <Select 
            value={filterOutlet}
            onChange={(val) => setFilterOutlet(String(val))}
            options={[
              { value: 'ALL', label: 'Semua Outlet' },
              ...(data?.outlets?.map((outlet: Outlet) => ({ value: outlet.id.toString(), label: outlet.name })) || [])
            ]}
            style={{ width: 180 }}
          />
          <Select 
            value={filterCategory}
            onChange={(val) => setFilterCategory(String(val))}
            options={[
              { value: 'ALL', label: 'Semua Kategori' },
              ...(data?.categories?.map((cat: { id: number, name: string }) => ({ value: cat.id.toString(), label: cat.name })) || [])
            ]}
            style={{ width: 180 }}
          />
          <Select 
            value={filterStatus}
            onChange={(val) => setFilterStatus(String(val))}
            options={[
              { value: 'ALL', label: 'Semua Kondisi' },
              { value: 'KRITIS', label: 'Stok Kritis / Menipis' },
              { value: 'AMAN', label: 'Stok Aman' }
            ]}
            style={{ width: 180 }}
          />
        </div>
        
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
                    <th style={{ minWidth: 250 }}>Nama Barang</th>
                    <th className="center" style={{ minWidth: 120, background: '#f8fafc' }}>Gudang Pusat</th>
                    {visibleOutlets.map(outlet => {
                      // Singkat nama outlet (contoh: ER COFFEELAB BANDUNG -> ER Bandung)
                      // Handle typo seperti COFFELAB, COFFEE LAB, dan hapus koma
                      const shortName = outlet.name
                        .replace(/COFFE\s*E?\s*LAB/i, '')
                        .replace(/,/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                      return (
                        <th key={outlet.id} className="center" style={{ minWidth: 140 }}>{shortName}</th>
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
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                        </td>
                        
                        {/* Gudang Pusat */}
                        <td className="center" style={{ background: '#f8fafc', fontWeight: 500 }}>
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
                            <td key={outlet.id} className="center">
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
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }}></div>
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
        <div style={{ padding: '12px 20px', fontSize: 12, color: '#64748b', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }}></div> Aman</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308' }}></div> Menipis (Hampir Kritis)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></div> Kritis (Di bawah batas)</div>
        </div>
        <Toast isOpen={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, open: false })} />
      </div>
      
      {!loading && data && totalPages > 1 && (
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}
      </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}

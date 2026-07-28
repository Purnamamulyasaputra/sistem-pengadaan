'use client';
import { useState, useEffect, useCallback } from 'react';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Search } from 'lucide-react';

import { Select } from '@/components/ui/Select';

interface CombinedStock {
  id: number;
  item_name: string;
  category_name: string;
  category_id: number;
  minimum_threshold: number;
  smallest_unit: string;
  purchase_unit: string;
  conversion_ratio: string;
  central_stock: string;
  outlet_stock: string;
  current_average_price: string;
}

export function CombinedStockView({ categories = [] }: { categories?: {id: number, name: string}[] }) {
  const [data, setData] = useState<CombinedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 20;

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/reports/combined-stock`);
    const json = await res.json();
    setData(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReport();
    setCurrentPage(1);
  }, [fetchReport]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCategory, filterStatus]);

  const filteredData = data.filter(item => {
    // Search
    const matchSearch = item.item_name.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    
    // Category
    if (filterCategory !== 'ALL' && item.category_id !== Number(filterCategory)) return false;
    
    // Status
    if (filterStatus !== 'ALL') {
      const central = Number(item.central_stock);
      const outlet = Number(item.outlet_stock);
      const total = central + outlet;
      
      let status = 'AMAN';
      const minStock = Number(item.minimum_threshold);
      if (minStock > 0) {
        if (total <= minStock) status = 'KRITIS';
        else if (total <= minStock * 1.5) status = 'MENIPIS';
      }
      
      if (filterStatus === 'KRITIS' && (status === 'KRITIS' || status === 'MENIPIS')) {
        return true;
      }
      if (filterStatus === 'AMAN' && status === 'AMAN') {
        return true;
      }
      return false;
    }
    
    return true;
  });

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <>
      <div className="card-body p-0">
        {!loading && data.length > 0 && (
          <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Aset Gudang Pusat</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                Rp {data.reduce((sum, item) => {
                  const r = Number(item.conversion_ratio) || 1;
                  return sum + (Number(item.central_stock) / r) * Math.round(Number(item.current_average_price) * r);
                }, 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Aset Seluruh Outlet</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                Rp {data.reduce((sum, item) => {
                  const r = Number(item.conversion_ratio) || 1;
                  return sum + (Number(item.outlet_stock) / r) * Math.round(Number(item.current_average_price) * r);
                }, 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ background: '#016e3f', padding: '8px 12px', borderRadius: 6, color: '#fff', boxShadow: '0 2px 4px rgba(1,110,63,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#a7f3d0', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grand Total Aset Perusahaan</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                Rp {data.reduce((sum, item) => {
                  const r = Number(item.conversion_ratio) || 1;
                  return sum + ((Number(item.central_stock) + Number(item.outlet_stock)) / r) * Math.round(Number(item.current_average_price) * r);
                }, 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div className="text-gray-500 font-medium" style={{ fontSize: 12 }}>Detail Stok Barang</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="input"
                placeholder="Cari barang/SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: 180, padding: '6px 12px 6px 30px', fontSize: 12 }}
              />
            </div>
            <Select 
              value={filterCategory}
              onChange={(val) => setFilterCategory(String(val))}
              options={[
                { value: 'ALL', label: 'Semua Kategori' },
                ...(categories.map((cat) => ({ value: cat.id.toString(), label: cat.name })))
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

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
          ) : data.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
              <h4>Belum ada data</h4>
              <p>Data stok gabungan tidak ditemukan.</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 200, whiteSpace: 'nowrap' }}>Nama Barang</th>
                      <th style={{ whiteSpace: 'nowrap' }}>Kategori</th>
                      <th className="right" style={{ whiteSpace: 'nowrap' }}>Stok Pusat</th>
                      <th className="right" style={{ whiteSpace: 'nowrap' }}>Nilai Pusat (Rp)</th>
                      <th className="right" style={{ whiteSpace: 'nowrap' }}>Total Stok Outlet</th>
                      <th className="right" style={{ whiteSpace: 'nowrap' }}>Nilai Outlet (Rp)</th>
                      <th className="right" style={{ whiteSpace: 'nowrap' }}>Total Stok Keseluruhan</th>
                      <th className="right" style={{ whiteSpace: 'nowrap' }}>Total Nilai (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map(item => {
                      const central = Number(item.central_stock);
                      const outlet = Number(item.outlet_stock);
                      const total = central + outlet;
                      const ratio = Number(item.conversion_ratio) || 1;

                      const valPusat = (central / ratio) * Math.round(Number(item.current_average_price) * ratio);
                      const valOutlet = (outlet / ratio) * Math.round(Number(item.current_average_price) * ratio);
                      const valTotal = valPusat + valOutlet;

                      const fmt = (val: number) => {
                        const largeVal = val / ratio;
                        return (
                          <div style={{ whiteSpace: 'nowrap' }}>
                            <div className="font-bold">{largeVal.toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span className="muted font-normal" style={{ fontSize: 11 }}>{item.purchase_unit}</span></div>
                            {ratio > 1 && (
                              <div className="muted font-mono" style={{ fontSize: 11 }}>
                                ({val.toLocaleString('id-ID')} {item.smallest_unit})
                              </div>
                            )}
                          </div>
                        );
                      };

                      const fmtRupiah = (val: number) => {
                        return <div className="font-mono text-sm" style={{ whiteSpace: 'nowrap' }}>{val.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>;
                      };

                      let totalColor = 'var(--primary)'; // Default hijau
                      const minStock = Number(item.minimum_threshold);
                      if (minStock > 0) {
                        if (total <= minStock) totalColor = '#ef4444'; // Kritis
                        else if (total <= minStock * 1.5) totalColor = '#eab308'; // Menipis
                      } else if (total < 0) {
                        totalColor = '#ef4444'; // Minus
                      }

                      return (
                        <tr key={item.id}>
                          <td className="font-bold" style={{ whiteSpace: 'nowrap' }}>{item.item_name}</td>
                          <td className="muted" style={{ whiteSpace: 'nowrap' }}>{item.category_name}</td>
                          <td className="right">{fmt(central)}</td>
                          <td className="right">{fmtRupiah(valPusat)}</td>
                          <td className="right">{fmt(outlet)}</td>
                          <td className="right">{fmtRupiah(valOutlet)}</td>
                          <td className="right">
                            <div style={{ color: totalColor }}>
                              {fmt(total)}
                            </div>
                          </td>
                          <td className="right">
                            <div style={{ color: totalColor, fontWeight: 'bold' }}>
                              {fmtRupiah(valTotal)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
              <div style={{ padding: '16px 24px' }}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={data.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

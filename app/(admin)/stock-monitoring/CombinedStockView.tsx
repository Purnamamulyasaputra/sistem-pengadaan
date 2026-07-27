'use client';
import { useState, useEffect, useCallback } from 'react';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';

interface CombinedStock {
  id: number;
  item_name: string;
  category_name: string;
  smallest_unit: string;
  purchase_unit: string;
  conversion_ratio: string;
  central_stock: string;
  outlet_stock: string;
  current_average_price: string;
}

export function CombinedStockView() {
  const [data, setData] = useState<CombinedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 20;

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    
    const res = await fetch(`/api/reports/combined-stock?${params}`);
    const json = await res.json();
    setData(json.data ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchReport();
    setCurrentPage(1);
  }, [fetchReport]);

  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
  const paginatedData = data.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Laporan Stok Gabungan (Pusat & Outlet)</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>
              Rekapitulasi stok keseluruhan di seluruh lokasi
            </p>
          </div>
          <div>
            <input 
              type="text" 
              className="input" 
              placeholder="Cari nama barang..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              style={{ width: 250 }}
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
                      <th style={{ minWidth: 200 }}>Nama Barang</th>
                      <th>Kategori</th>
                      <th className="right">Stok Pusat</th>
                      <th className="right">Total Stok Outlet</th>
                      <th className="right">Total Stok Keseluruhan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map(item => {
                      const central = Number(item.central_stock);
                      const outlet = Number(item.outlet_stock);
                      const total = central + outlet;
                      const ratio = Number(item.conversion_ratio) || 1;
                      
                      const fmt = (val: number) => {
                        const largeVal = val / ratio;
                        return (
                          <div>
                            <div className="font-bold">{largeVal.toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span className="muted font-normal" style={{ fontSize: 11 }}>{item.purchase_unit}</span></div>
                            {ratio > 1 && (
                              <div className="muted font-mono" style={{ fontSize: 11 }}>
                                ({val.toLocaleString('id-ID')} {item.smallest_unit})
                              </div>
                            )}
                          </div>
                        );
                      };

                      return (
                        <tr key={item.id}>
                          <td className="font-bold">{item.item_name}</td>
                          <td className="muted">{item.category_name}</td>
                          <td className="right">{fmt(central)}</td>
                          <td className="right">{fmt(outlet)}</td>
                          <td className="right">
                            <div style={{ color: 'var(--primary)' }}>
                              {fmt(total)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={data.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

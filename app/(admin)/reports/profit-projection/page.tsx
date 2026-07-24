'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';

const rp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

interface ProjectionItem {
  id: number;
  name: string;
  category_name: string;
  current_stock: number;
  smallest_unit: string;
  current_average_price: number;
  estimated_sale_price: number;
}

export default function ProfitProjectionPage() {
  const [items, setItems] = useState<ProjectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    fetch('/api/items?active_only=true&limit=1000')
      .then(r => r.json())
      .then(d => {
        const raw = d.data || [];
        // Hanya ambil barang yang stoknya ada untuk diproyeksikan
        const init = raw.filter((i: any) => i.current_stock > 0).map((i: any) => ({
          ...i,
          // Secara bawaan kita kasih contoh estimasi jual = modal x 2 (100% margin)
          estimated_sale_price: i.current_average_price * 2 
        }));
        setItems(init);
        setLoading(false);
      });
  }, []);

  const updateSalePrice = (idx: number, val: string) => {
    const newItems = [...items];
    newItems[idx].estimated_sale_price = Number(val) || 0;
    setItems(newItems);
  };

  const categories = Array.from(new Set(items.map(r => r.category_name || 'Tidak Berkategori'))).sort();

  const filteredItems = items.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter ? (r.category_name || 'Tidak Berkategori') === categoryFilter : true;
    return matchSearch && matchCat;
  });

  let totalCost = 0;
  let totalRevenue = 0;
  let totalProfit = 0;

  filteredItems.forEach(item => {
    const cost = item.current_stock * item.current_average_price;
    const rev = item.current_stock * item.estimated_sale_price;
    totalCost += cost;
    totalRevenue += rev;
    totalProfit += (rev - cost);
  });

  return (
    <section style={{ margin: '-16px -20px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div className="tabs" style={{ marginBottom: 0, padding: '0 24px', paddingTop: 16 }}>
          <a href="/reports" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Grafik Keuangan</a>
          <a href="/reports/inventory-value" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Tabel Persediaan</a>
          <a href="/price-history" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Riwayat Harga</a>
          <a href="/reports/profit-projection" className="tab active" style={{ textDecoration: 'none' }}>Simulator Laba</a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Simulator Laba Stok</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>Simulasikan potensi pendapatan dan keuntungan dari saldo stok gudang Anda saat ini.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input"
              placeholder="Cari nama barang..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 180, padding: '2px 8px', fontSize: 12, height: 28 }}
            />
            <Select
              value={categoryFilter}
              onChange={val => setCategoryFilter(val)}
              options={[
                { value: '', label: 'Semua Kategori' },
                ...categories.map(c => ({ value: c, label: c }))
              ]}
              style={{ width: 140 }}
              inputStyle={{ padding: '2px 8px', fontSize: 12, height: 28 }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data proyeksi...</div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>
              <h4>Tidak Ada Stok</h4>
              <p>Belum ada stok fisik di gudang untuk disimulasikan.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Tidak ada barang yang sesuai dengan pencarian.</div>
          ) : (
            <div className="table-responsive">
              <Table>
                <thead>
                  <tr>
                    <th style={{ padding: '10px 24px', fontSize: 11, minWidth: 200 }}>Nama Barang</th>
                    <th className="right" style={{ padding: '10px 24px', fontSize: 11, width: 120 }}>Stok Saat Ini</th>
                    <th className="right" style={{ padding: '10px 24px', fontSize: 11, width: 140 }}>Rata-rata Modal/Unit</th>
                    <th className="right" style={{ padding: '10px 24px', fontSize: 11, width: 150 }}>Total Modal</th>
                    <th className="right" style={{ padding: '10px 24px', fontSize: 11, width: 140 }}>Est. Harga Jual/Unit</th>
                    <th className="right" style={{ padding: '10px 24px', fontSize: 11, width: 150, color: '#016e3f' }}>Total Pendapatan</th>
                    <th className="right" style={{ padding: '10px 24px', fontSize: 11, width: 150, color: '#0ea5e9' }}>Proyeksi Laba</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: 12 }}>
                  {filteredItems.map((item) => {
                    const cost = item.current_stock * item.current_average_price;
                    const rev = item.current_stock * item.estimated_sale_price;
                    const profit = rev - cost;
                    
                    // find original index for updateSalePrice
                    const originalIdx = items.findIndex(i => i.id === item.id);
                    
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="font-bold" style={{ padding: '8px 24px' }}>{item.name}</td>
                        <td className="right num" style={{ padding: '8px 24px' }}>{Number(item.current_stock).toLocaleString('id-ID')} <span className="muted" style={{ fontSize: 11 }}>{item.smallest_unit}</span></td>
                        <td className="right num muted" style={{ padding: '8px 24px' }}>{rp(item.current_average_price)}</td>
                        <td className="right num" style={{ padding: '8px 24px' }}>{rp(cost)}</td>
                        <td className="right" style={{ padding: '4px 24px' }}>
                          <input 
                            className="input right num" 
                            type="number" 
                            style={{ width: '90px', padding: '2px 8px', height: 28, fontSize: 12 }}
                            value={item.estimated_sale_price === 0 ? '' : item.estimated_sale_price}
                            onChange={(e) => updateSalePrice(originalIdx, e.target.value)}
                            onFocus={e => e.target.select()}
                          />
                        </td>
                        <td className="right num font-bold" style={{ padding: '8px 24px', color: '#016e3f' }}>{rp(rev)}</td>
                        <td className="right num font-bold" style={{ padding: '8px 24px', color: '#0ea5e9' }}>{rp(profit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid var(--border)', fontSize: 12 }}>
                    <td colSpan={3} className="right" style={{ padding: '12px 24px' }}>TOTAL KESELURUHAN (FILTERED)</td>
                    <td className="right num" style={{ padding: '12px 24px' }}>{rp(totalCost)}</td>
                    <td style={{ padding: '12px 24px' }}></td>
                    <td className="right num" style={{ padding: '12px 24px', color: '#016e3f' }}>{rp(totalRevenue)}</td>
                    <td className="right num" style={{ padding: '12px 24px', color: '#0ea5e9' }}>{rp(totalProfit)}</td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

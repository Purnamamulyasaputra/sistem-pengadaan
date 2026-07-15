'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/components/ui/Table';

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

  let totalCost = 0;
  let totalRevenue = 0;
  let totalProfit = 0;

  items.forEach(item => {
    const cost = item.current_stock * item.current_average_price;
    const rev = item.current_stock * item.estimated_sale_price;
    totalCost += cost;
    totalRevenue += rev;
    totalProfit += (rev - cost);
  });

  return (
    <section className="screen">
      <div className="card">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <a href="/reports" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Financial Report</a>
          <a href="/price-history" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Price History</a>
          <a href="/reports/profit-projection" className="tab active" style={{ textDecoration: 'none' }}>Profit Simulator</a>
        </div>
        <div className="card-head">
          <div>
            <h3>Stock Profit Simulator</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>Simulasikan potensi pendapatan dan keuntungan dari saldo stok gudang Anda saat ini.</p>
          </div>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading projection data...</div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>
              <h4>No Stock Available</h4>
              <p>Belum ada stok fisik di gudang untuk disimulasikan.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', fontSize: 12 }}>Item Name</th>
                    <th className="right" style={{ padding: '8px 12px', fontSize: 12 }}>Current Stock</th>
                    <th className="right" style={{ padding: '8px 12px', fontSize: 12 }}>Avg Cost/Unit</th>
                    <th className="right" style={{ padding: '8px 12px', fontSize: 12 }}>Total Cost (Modal)</th>
                    <th className="right" style={{ padding: '8px 12px', fontSize: 12, width: 140 }}>Est. Sale Price/Unit</th>
                    <th className="right" style={{ padding: '8px 12px', fontSize: 12, color: '#016e3f' }}>Total Revenue</th>
                    <th className="right" style={{ padding: '8px 12px', fontSize: 12, color: '#0ea5e9' }}>Projected Profit</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: 13 }}>
                  {items.map((item, i) => {
                    const cost = item.current_stock * item.current_average_price;
                    const rev = item.current_stock * item.estimated_sale_price;
                    const profit = rev - cost;
                    
                    return (
                      <tr key={item.id}>
                        <td className="font-bold" style={{ padding: '6px 12px' }}>{item.name}</td>
                        <td className="right num" style={{ padding: '6px 12px' }}>{Number(item.current_stock).toLocaleString('id-ID')} <span className="muted" style={{ fontSize: 11 }}>{item.smallest_unit}</span></td>
                        <td className="right num muted" style={{ padding: '6px 12px' }}>{rp(item.current_average_price)}</td>
                        <td className="right num" style={{ padding: '6px 12px' }}>{rp(cost)}</td>
                        <td className="right" style={{ padding: '4px 12px' }}>
                          <input 
                            className="input right num" 
                            type="number" 
                            style={{ width: '90px', padding: '2px 8px', height: 28, fontSize: 13 }}
                            value={item.estimated_sale_price === 0 ? '' : item.estimated_sale_price}
                            onChange={(e) => updateSalePrice(i, e.target.value)}
                            onFocus={e => e.target.select()}
                          />
                        </td>
                        <td className="right num font-bold" style={{ padding: '6px 12px', color: '#016e3f' }}>{rp(rev)}</td>
                        <td className="right num font-bold" style={{ padding: '6px 12px', color: '#0ea5e9' }}>{rp(profit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid var(--border)', fontSize: 13 }}>
                    <td colSpan={3} className="right" style={{ padding: '8px 12px' }}>GRAND TOTAL PROJECTION</td>
                    <td className="right num" style={{ padding: '8px 12px' }}>{rp(totalCost)}</td>
                    <td style={{ padding: '8px 12px' }}></td>
                    <td className="right num" style={{ padding: '8px 12px', color: '#016e3f' }}>{rp(totalRevenue)}</td>
                    <td className="right num" style={{ padding: '8px 12px', color: '#0ea5e9' }}>{rp(totalProfit)}</td>
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

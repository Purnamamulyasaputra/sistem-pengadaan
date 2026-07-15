'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { Calculator, ShoppingBag, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

type SalesSummaryRow = {
  menu_id: number;
  display_name: string;
  category_name: string;
  sale_price: number;
  total_qty: number;
  total_revenue: number;
};

export default function SalesAnalyticsPage() {
  const router = useRouter();

  const [outletId, setOutletId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState<SalesSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters and Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('revenue_desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  // Set default dates on mount (Last 7 days)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);

    setDateTo(end.toISOString().split('T')[0]);
    setDateFrom(start.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.outlet_id) setOutletId(d.data.outlet_id);
      })
      .catch(err => console.error('Error fetching session:', err));
  }, []);

  useEffect(() => {
    if (dateFrom && dateTo && outletId) {
      loadData();
    }
  }, [dateFrom, dateTo, outletId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales-transactions/summary?outlet_id=${outletId}&dateFrom=${dateFrom}&dateTo=${dateTo}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = data.reduce((sum, r) => sum + Number(r.total_revenue), 0);
  const totalItemsSold = data.reduce((sum, r) => sum + Number(r.total_qty), 0);

  const rp = (v: number) => `Rp ${Math.round(v).toLocaleString('id-ID')}`;

  const handleGenerateEstimation = () => {
    // Navigate to estimation page with current date parameters
    router.push(`/outlet/sales/estimation?dateFrom=${dateFrom}&dateTo=${dateTo}`);
  };

  // Extract unique categories for filter
  const categories = Array.from(new Set(data.map(d => d.category_name))).sort();

  // Filter data based on search and category
  const filteredData = data.filter(d => {
    const matchSearch = d.display_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory ? d.category_name === selectedCategory : true;
    return matchSearch && matchCategory;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (sortBy === 'revenue_desc') return Number(b.total_revenue) - Number(a.total_revenue);
    if (sortBy === 'qty_desc') return Number(b.total_qty) - Number(a.total_qty);
    if (sortBy === 'name_asc') return a.display_name.localeCompare(b.display_name);
    return 0;
  });

  const totalPages = Math.ceil(sortedData.length / limit);
  const paginatedData = sortedData.slice((page - 1) * limit, page * limit);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory, sortBy, limit]);

  return (
    <section className="screen">
      {/* Header and Stats Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>Sales Analytics</h3>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              className="input"
              style={{ padding: '6px 12px', fontSize: 13, width: 130, cursor: 'pointer' }}
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              onClick={e => (e.target as HTMLInputElement).showPicker?.()}
              onKeyDown={e => e.preventDefault()}
            />
            <span style={{ fontWeight: 600, color: 'var(--muted)', fontSize: 13 }}>to</span>
            <input
              type="date"
              className="input"
              style={{ padding: '6px 12px', fontSize: 13, width: 130, cursor: 'pointer' }}
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              onClick={e => (e.target as HTMLInputElement).showPicker?.()}
              onKeyDown={e => e.preventDefault()}
            />
          </div>
        </div>

        {/* Stats row resembling HPP page */}
        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <div style={{
            flex: '1 1 200px', padding: '16px 20px', borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calculator size={16} strokeWidth={2.5} style={{ color: '#016e3f' }} />
              <div className="muted" style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>Total Revenue</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)' }}>{rp(totalRevenue)}</div>
          </div>

          <div style={{
            flex: '1 1 200px', padding: '16px 20px',
            display: 'flex', flexDirection: 'column', gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShoppingBag size={16} strokeWidth={2.5} style={{ color: '#016e3f' }} />
              <div className="muted" style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>Portions Sold</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)' }}>{totalItemsSold.toLocaleString('id-ID')}</div>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="card">
        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: 12, padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
          <input
            className="input"
            placeholder="Search menu name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: 220 }}
          />
          <Select
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={[
              { value: '', label: 'All Categories' },
              ...categories.map(c => ({ value: c, label: c }))
            ]}
            style={{ width: 160 }}
          />
          <Select
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'revenue_desc', label: 'Highest Revenue' },
              { value: 'qty_desc', label: 'Most Qty Sold' },
              { value: 'name_asc', label: 'Menu Name (A-Z)' }
            ]}
            style={{ width: 180 }}
          />
          <Select
            value={limit}
            onChange={setLimit}
            options={[
              { value: 8, label: '8' },
              { value: 15, label: '15' },
              { value: 32, label: '32' },
              { value: 50, label: '50' }
            ]}
            style={{ width: 80 }}
          />
          <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>
            {filteredData.length} Menus found
          </span>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }} className="muted">Memuat data...</div>
          ) : filteredData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }} className="muted">Tidak ada data yang sesuai filter pencarian.</div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Menu Name</th>
                  <th>Category</th>
                  <th className="right">Sale Price</th>
                  <th className="right">Qty Sold</th>
                  <th className="right">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(row => (
                  <tr key={row.menu_id}>
                    <td style={{ fontWeight: 600 }}>{row.display_name}</td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--muted)', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                        {row.category_name}
                      </span>
                    </td>
                    <td className="right">{rp(row.sale_price)}</td>
                    <td className="right" style={{ fontWeight: 700 }}>{row.total_qty}</td>
                    <td className="right" style={{ fontWeight: 600, color: '#016e3f' }}>{rp(row.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16, borderTop: '1px solid var(--border)' }}>
            <button
              className="btn"
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Hal. {page} dari {totalPages}</span>
            <button
              className="btn"
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

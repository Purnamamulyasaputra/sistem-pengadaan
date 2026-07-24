'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/inventory-value?month=${month}&year=${year}`)
      .then(r => r.json())
      .then(d => {
        setReportData(d.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [month, year]);



  let grandTotalIn = 0;
  let grandTotalDist = 0;
  let grandTotalAdj = 0;
  let grandTotalValue = 0;

  const categoryMap = new Map<string, number>();

  reportData.forEach(r => {
    const ma = Number(r.current_average_price);
    const valIn = Number(r.total_in_qty) * ma;
    const valDist = Number(r.total_distribution_qty) * ma;
    const valAdj = Math.abs(Number(r.total_adj_qty)) * ma;
    const valCurrent = Number(r.current_balance) * ma;

    grandTotalIn += valIn;
    grandTotalDist += valDist;
    grandTotalAdj += valAdj;
    grandTotalValue += valCurrent;

    const cat = r.category_name || 'Tidak Berkategori';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + valCurrent);
  });

  const chartData = Array.from(categoryMap.entries()).map(([name, value]) => ({
    name,
    'Nilai Persediaan': value
  }));

  return (
    <section className="screen">
      <div className="card">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <a href="/reports" className="tab active" style={{ textDecoration: 'none' }}>Grafik Keuangan</a>
          <a href="/reports/inventory-value" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Tabel Persediaan</a>
          <a href="/price-history" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Riwayat Harga</a>
          <a href="/reports/profit-projection" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Simulator Laba</a>
        </div>
        <div className="card-head">
          <div>
            <h3>Grafik Keuangan Pengadaan & Persediaan</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>Nilai dihitung menggunakan algoritma Moving Average.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Select 
              value={month} 
              onChange={(val) => setMonth(Number(val))}
              options={Array.from({length: 12}).map((_, i) => ({ value: i+1, label: new Date(0, i).toLocaleString('id-ID', { month: 'long' }) }))}
              style={{ width: 140 }}
            />
            <Select 
              value={year} 
              onChange={(val) => setYear(Number(val))}
              options={[year-1, year, year+1].map(y => ({ value: y, label: String(y) }))}
              style={{ width: 100 }}
            />
          </div>
        </div>
        
        {chartData.length > 0 && (
          <div style={{ padding: '24px' }}>
            <h4 style={{ marginBottom: 16 }}>Nilai Persediaan Saat Ini Berdasarkan Kategori</h4>
            <div style={{ height: 220, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tickFormatter={(val) => val.length > 20 ? val.substring(0, 20) + '...' : val} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} interval={0} />
                  <YAxis tickFormatter={(val) => `Rp${(val/1000000).toFixed(1)}M`} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, undefined]}
                    cursor={false}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="Nilai Persediaan" fill="#016e3f" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
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

  const exportExcel = () => {
    if (reportData.length === 0) {
      alert("No data to export");
      return;
    }
    
    const wsData = reportData.map(r => ({
      'Item Name': r.item_name,
      'Category': r.category_name,
      'Total IN (Qty)': Number(r.total_in_qty),
      'Total IN (Value Rp)': Number(r.total_in_qty) * Number(r.current_average_price),
      'Total Distributed (Qty)': Number(r.total_distribution_qty),
      'Total Distributed (Value Rp)': Number(r.total_distribution_qty) * Number(r.current_average_price),
      'Total Adjusted (Qty)': Number(r.total_adj_qty),
      'Total Adjusted (Value Rp)': Math.abs(Number(r.total_adj_qty)) * Number(r.current_average_price),
      'Current Balance (Qty)': Number(r.current_balance),
      'Current MA Price': Number(r.current_average_price),
      'Current Value (Rp)': Number(r.current_balance) * Number(r.current_average_price),
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory Value Report');
    XLSX.writeFile(wb, `Inventory_Report_${year}_${month}.xlsx`);
  };

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

    const cat = r.category_name || 'Uncategorized';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + valCurrent);
  });

  const chartData = Array.from(categoryMap.entries()).map(([name, value]) => ({
    name,
    'Inventory Value': value
  }));

  return (
    <section className="screen">
      <div className="card">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <a href="/reports" className="tab active" style={{ textDecoration: 'none' }}>Financial Report</a>
          <a href="/price-history" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Price History</a>
          <a href="/reports/profit-projection" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Profit Simulator</a>
        </div>
        <div className="card-head">
          <div>
            <h3>Procurement & Inventory Financial Report</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>Values calculated using Moving Average algorithm.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select className="input" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {Array.from({length: 12}).map((_, i) => (
                <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
              ))}
            </select>
            <select className="input" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[year-1, year, year+1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={exportExcel}>⬇ Export Excel</Button>
          </div>
        </div>
        
        {chartData.length > 0 && (
          <div style={{ padding: '24px 24px 0 24px' }}>
            <h4 style={{ marginBottom: 16 }}>Current Inventory Value by Category</h4>
            <div style={{ height: 300, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} interval={0} angle={-25} textAnchor="end" />
                  <YAxis tickFormatter={(val) => `Rp${(val/1000000).toFixed(1)}M`} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, undefined]}
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="Inventory Value" fill="#016e3f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="card-body flush" style={{ marginTop: 24 }}>
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading financial data...</div>
          ) : reportData.length === 0 ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>No transactions found for this period.</div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th className="right">Total IN Value</th>
                  <th className="right">Distributed Value</th>
                  <th className="right" style={{ color: '#dc2626' }}>Adjusted Value</th>
                  <th className="right" style={{ background: '#f8fafc' }}>Current Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((r, i) => {
                  const ma = Number(r.current_average_price);
                  const valIn = Number(r.total_in_qty) * ma;
                  const valDist = Number(r.total_distribution_qty) * ma;
                  const valAdj = Math.abs(Number(r.total_adj_qty)) * ma;
                  const valCurrent = Number(r.current_balance) * ma;
                  
                  return (
                    <tr key={i}>
                      <td className="font-bold">{r.item_name}</td>
                      <td className="muted">{r.category_name}</td>
                      <td className="right num">Rp {valIn.toLocaleString('id-ID')}</td>
                      <td className="right num">Rp {valDist.toLocaleString('id-ID')}</td>
                      <td className="right num" style={{ color: valAdj > 0 ? '#dc2626' : 'inherit' }}>
                        Rp {valAdj.toLocaleString('id-ID')}
                      </td>
                      <td className="right num font-bold" style={{ background: '#f8fafc', color: '#016e3f' }}>
                        Rp {valCurrent.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f1f5f9', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                  <td colSpan={2} className="right">GRAND TOTAL</td>
                  <td className="right num">Rp {grandTotalIn.toLocaleString('id-ID')}</td>
                  <td className="right num">Rp {grandTotalDist.toLocaleString('id-ID')}</td>
                  <td className="right num" style={{ color: '#dc2626' }}>Rp {grandTotalAdj.toLocaleString('id-ID')}</td>
                  <td className="right num" style={{ color: '#016e3f', fontSize: 15 }}>Rp {grandTotalValue.toLocaleString('id-ID')}</td>
                </tr>
              </tfoot>
            </Table>
          )}
        </div>
      </div>
    </section>
  );
}

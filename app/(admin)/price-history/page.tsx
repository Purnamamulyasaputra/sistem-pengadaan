'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/components/ui/Table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function PriceHistoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/items').then(r => r.json()).then(d => setItems(d.data ?? []));
    fetch('/api/vendors').then(r => r.json()).then(d => setVendors(d.data ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    let url = '/api/price-history?limit=100';
    if (selectedItemId) url += `&item_id=${selectedItemId}`;
    if (selectedVendorId) url += `&vendor_id=${selectedVendorId}`;

    fetch(url)
      .then(r => r.json())
      .then(d => {
        setHistory(d.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedItemId, selectedVendorId]);

  const chartData = selectedItemId ? [...history].reverse().map(h => ({
    date: new Date(h.purchase_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }),
    'Purchase Price': Number(h.unit_purchase_price),
    'Moving Average': Number(h.new_average_price),
  })) : [];

  return (
    <section className="screen">
      <div className="card">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <a href="/reports" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Financial Report</a>
          <a href="/price-history" className="tab active" style={{ textDecoration: 'none' }}>Price History</a>
          <a href="/reports/profit-projection" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Profit Simulator</a>
        </div>
        <div className="card-head">
          <div>
            <h3>Purchase Price History</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>Track item price fluctuations and moving average updates.</p>
          </div>
        </div>

        <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16 }}>
          <select
            className="input"
            value={selectedItemId}
            onChange={e => setSelectedItemId(e.target.value)}
            style={{ minWidth: 250 }}
          >
            <option value="">All Items</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <select
            className="input"
            value={selectedVendorId}
            onChange={e => setSelectedVendorId(e.target.value)}
            style={{ minWidth: 250 }}
          >
            <option value="">All Vendors</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        {selectedItemId && chartData.length > 0 && (
          <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ marginBottom: 16 }}>Price Trend</h4>
            <div style={{ height: 300, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                  <YAxis tickFormatter={(val) => `Rp${(val / 1000)}k`} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, undefined]}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
                  <Line type="monotone" dataKey="Purchase Price" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="stepAfter" dataKey="Moving Average" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading price history...</div>
          ) : history.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 16, color: 'var(--muted)' }}>
                <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16" />
              </svg>
              <h4>No price history found</h4>
              <p className="muted">Adjust your filters or record a goods receipt to generate history.</p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Purchase Date</th>
                  <th>Item</th>
                  <th>Vendor</th>
                  <th className="right">Qty Received</th>
                  <th className="right">Purchase Price</th>
                  <th className="right">New Moving Average</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td>
                      {new Date(h.purchase_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      <div className="muted font-mono" style={{ fontSize: 12 }}>{h.purchase_order_item_id ? `PO Item: ${h.purchase_order_item_id}` : 'Manual Entry'}</div>
                    </td>
                    <td className="font-bold">{h.item_name}</td>
                    <td>{h.vendor_name || '-'}</td>
                    <td className="right font-bold num">{h.purchase_qty} <span className="muted">{h.purchase_unit}</span></td>
                    <td className="right font-mono" style={{ color: '#016e3f', fontWeight: 600 }}>
                      Rp {Number(h.unit_purchase_price).toLocaleString('id-ID')}
                    </td>
                    <td className="right font-mono" style={{ color: '#f59e0b', fontWeight: 600 }}>
                      Rp {Number(h.new_average_price).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </section>
  );
}

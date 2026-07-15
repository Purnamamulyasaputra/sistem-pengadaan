'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';

interface LogEntry {
  id: number;
  created_at: string;
  movement_type: 'IN' | 'OUT' | 'ADJ';
  qty_change: number;
  ending_balance: number;
  reference_type: string;
  reference_id: number;
}

export default function StockCardPage() {
  const [items, setItems] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/items').then(r => r.json()).then(d => setItems(d.data ?? []));
  }, []);

  useEffect(() => {
    if (!selectedItemId) {
      setLogs([]);
      return;
    }
    setLoading(true);
    fetch(`/api/inventory/card?item_id=${selectedItemId}`)
      .then(r => r.json())
      .then(d => {
        setLogs(d.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedItemId]);

  const selectedItem = items.find(i => String(i.id) === selectedItemId);

  // Derive summaries from the logs (since logs are returned in desc order by created_at)
  const currentBalance = logs.length > 0 ? logs[0].ending_balance : (selectedItem?.current_stock ?? 0);

  const lastIn = logs.find(l => l.movement_type === 'IN')?.created_at;
  const lastOut = logs.find(l => l.movement_type === 'OUT')?.created_at;

  return (
    <section className="screen">
      <div className="card">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <a href="/warehouse" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Goods Receipts</a>
          <a href="/stock-card" className="tab active" style={{ textDecoration: 'none' }}>Stock Card</a>
          <a href="/delivery-orders" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Delivery Orders</a>
          <a href="/opname/central" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Central Opname</a>
        </div>
        <div className="card-head">
          <div>
            <h3>Stock Card</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>Global Inventory Movements</p>
          </div>
          <div>
            <Select 
              value={selectedItemId} 
              onChange={setSelectedItemId}
              options={items.map(i => ({ value: String(i.id), label: `${i.name} (${i.smallest_unit})` }))}
              style={{ minWidth: 300 }}
              searchable={true}
            />
          </div>
        </div>

        {selectedItemId && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
            <div>
              <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Current Balance</p>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {Number(currentBalance).toLocaleString('id-ID')} <span className="muted" style={{ fontSize: 14 }}>{selectedItem?.smallest_unit}</span>
              </div>
            </div>
            <div>
              <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Last Receipt (IN)</p>
              <div style={{ fontWeight: 600 }}>
                {lastIn ? new Date(lastIn).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
              </div>
            </div>
            <div>
              <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Last Distribution (OUT)</p>
              <div style={{ fontWeight: 600 }}>
                {lastOut ? new Date(lastOut).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
              </div>
            </div>
          </div>
        )}

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading stock card data...</div>
          ) : !selectedItemId ? (
            <div className="muted" style={{ padding: 60, textAlign: 'center' }}>
              Please select an item from the dropdown to view its stock card.
            </div>
          ) : logs.length === 0 ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>
              No inventory movements recorded for this item.
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Mutation Type</th>
                  <th className="right">Change (Qty)</th>
                  <th className="right">Ending Balance</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>
                      {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      <div className="muted" style={{ fontSize: 12 }}>{new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td>
                      <Badge variant={log.movement_type === 'IN' ? 'green' : log.movement_type === 'OUT' ? 'blue' : 'amber'}>
                        {log.movement_type}
                      </Badge>
                    </td>
                    <td className="right font-mono font-bold" style={{ color: log.movement_type === 'OUT' || log.qty_change < 0 ? '#dc2626' : '#16a34a' }}>
                      {log.qty_change > 0 ? '+' : ''}{Number(log.qty_change).toLocaleString('id-ID')} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>{selectedItem?.smallest_unit}</span>
                    </td>
                    <td className="right font-mono font-bold">
                      {Number(log.ending_balance).toLocaleString('id-ID')} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>{selectedItem?.smallest_unit}</span>
                    </td>
                    <td>
                      <div className="font-bold">{log.reference_type}</div>
                      <div className="muted font-mono" style={{ fontSize: 12 }}>Ref ID: {log.reference_id}</div>
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

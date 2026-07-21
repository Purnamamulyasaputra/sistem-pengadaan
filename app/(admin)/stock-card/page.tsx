'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/items').then(r => r.json()),
      fetch('/api/categories').then(r => r.json())
    ]).then(([itemsRes, catRes]) => {
      setItems(itemsRes.data ?? []);
      setCategories(catRes.data ?? []);
      setLoading(false);
    });
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

  useEffect(() => {
    setCurrentPage(1);
  }, [search, catFilter, statusFilter]);

  const selectedItem = items.find(i => String(i.id) === selectedItemId);

  // Derive summaries from the logs (since logs are returned in desc order by created_at)
  const currentBalance = logs.length > 0 ? logs[0].ending_balance : (selectedItem?.current_stock ?? 0);

  const lastIn = logs.find(l => l.movement_type === 'IN')?.created_at;
  const lastOut = logs.find(l => l.movement_type === 'OUT')?.created_at;

  const filteredItems = items.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !String(i.id).includes(search)) return false;
    if (catFilter && String(i.category_id) !== catFilter) return false;
    
    if (statusFilter) {
      const current = Number(i.current_stock ?? 0);
      const min = Number(i.minimum_threshold ?? 0);
      
      if (statusFilter === 'SAFE' && current < min) return false;
      if (statusFilter === 'LOW' && (current >= min || current <= 0)) return false;
      if (statusFilter === 'OUT' && current > 0) return false;
    }
    
    return true;
  });

  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Central Warehouse Stock</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>
              Real-time physical stock vs minimum threshold
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input 
              className="input" 
              placeholder="Search item name..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              style={{ width: 200 }} 
            />
            <select className="input" style={{ width: 150 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
            <select className="input" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="SAFE">Safe</option>
              <option value="LOW">Low Stock</option>
              <option value="OUT">Out of Stock</option>
            </select>
          </div>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading inventory...</div>
            ) : filteredItems.length === 0 ? (
              <div className="muted" style={{ padding: 40, textAlign: 'center' }}>No items found.</div>
            ) : (
              <>
                <Table>
                  <thead>
                  <tr>
                    <th>Code</th>
                    <th>Item Name</th>
                    <th className="right">Min. Stock</th>
                    <th className="right">Physical Stock</th>
                    <th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map(item => {
                    const ratio = Number(item.conversion_ratio || 1);
                    const currentStockSmallest = Number(item.current_stock ?? 0);
                    const minStockSmallest = Number(item.minimum_threshold ?? 0);
                    
                    const currentStock = currentStockSmallest / ratio;
                    const minStock = minStockSmallest / ratio;
                    
                    const isLow = currentStockSmallest < minStockSmallest;
                    const isOut = currentStockSmallest <= 0;
                    
                    return (
                      <tr key={item.id} onClick={() => setSelectedItemId(String(item.id))} className="cursor-pointer" title="View Stock Card">
                        <td className="font-mono text-muted">ERC{String(item.id).padStart(5, '0')}</td>
                        <td className="font-bold">{item.name}</td>
                        <td className="right">
                          <div className="num font-bold">{minStock.toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>{item.purchase_unit || item.smallest_unit}</span></div>
                          {ratio > 1 && <div className="muted" style={{ fontSize: 11 }}>({minStockSmallest.toLocaleString('id-ID')} {item.smallest_unit})</div>}
                        </td>
                        <td className="right">
                          <div className="num font-bold" style={{ color: isOut ? '#dc2626' : isLow ? '#d97706' : '#059669', fontSize: 14 }}>
                            {currentStock.toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span style={{ fontSize: 12, fontWeight: 500, color: 'inherit', opacity: 0.8 }}>{item.purchase_unit || item.smallest_unit}</span>
                          </div>
                          {ratio > 1 && <div className="muted" style={{ fontSize: 11 }}>({currentStockSmallest.toLocaleString('id-ID')} {item.smallest_unit})</div>}
                        </td>
                        <td className="center">
                          <Badge variant={isOut ? 'red' : isLow ? 'amber' : 'green'}>
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Safe'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredItems.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </>
          )}
          </div>
      </div>

      <Modal 
        isOpen={!!selectedItemId} 
        onClose={() => setSelectedItemId('')} 
        title={`Stock Card — ${selectedItem?.name}`} 
        maxWidth={800}
        footer={<Button variant="outline" onClick={() => setSelectedItemId('')}>Close</Button>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Current Balance</p>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {(Number(currentBalance) / Number(selectedItem?.conversion_ratio || 1)).toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span className="muted" style={{ fontSize: 14 }}>{selectedItem?.purchase_unit || selectedItem?.smallest_unit}</span>
            </div>
            {Number(selectedItem?.conversion_ratio || 1) > 1 && (
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                ({Number(currentBalance).toLocaleString('id-ID')} {selectedItem?.smallest_unit})
              </div>
            )}
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

        <div className="card-body flush" style={{ overflowY: 'visible' }}>
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading stock card data...</div>
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
                {logs.map(log => {
                  const ratio = Number(selectedItem?.conversion_ratio || 1);
                  const convertedQtyChange = log.qty_change / ratio;
                  const convertedEndingBalance = log.ending_balance / ratio;
                  
                  return (
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
                    <td className="right">
                      <div className="font-mono font-bold" style={{ color: log.movement_type === 'OUT' || log.qty_change < 0 ? '#dc2626' : '#16a34a' }}>
                        {log.qty_change > 0 ? '+' : ''}{Number(convertedQtyChange).toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span style={{ fontSize: 11, fontWeight: 500, color: 'inherit', opacity: 0.8 }}>{selectedItem?.purchase_unit || selectedItem?.smallest_unit}</span>
                      </div>
                      {ratio > 1 && (
                        <div className="muted font-mono" style={{ fontSize: 11 }}>
                          ({log.qty_change > 0 ? '+' : ''}{Number(log.qty_change).toLocaleString('id-ID')} {selectedItem?.smallest_unit})
                        </div>
                      )}
                    </td>
                    <td className="right">
                      <div className="font-mono font-bold">
                        {Number(convertedEndingBalance).toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>{selectedItem?.purchase_unit || selectedItem?.smallest_unit}</span>
                      </div>
                      {ratio > 1 && (
                        <div className="muted font-mono" style={{ fontSize: 11 }}>
                          ({Number(log.ending_balance).toLocaleString('id-ID')} {selectedItem?.smallest_unit})
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="font-bold">{log.reference_type}</div>
                      <div className="muted font-mono" style={{ fontSize: 12 }}>Ref ID: {log.reference_id}</div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>
      </Modal>
    </section>
  );
}

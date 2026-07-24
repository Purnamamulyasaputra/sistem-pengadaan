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

  // Auto-convert smallest unit value to a human-readable central unit
  function toCentralDisplay(valueInSmallest: number, smallestUnit: string) {
    const u = (smallestUnit || '').toLowerCase();
    if (u === 'ml') return { value: valueInSmallest / 1000, unit: 'Liter' };
    if (u === 'gr' || u === 'g') return { value: valueInSmallest / 1000, unit: 'Kg' };
    return { value: valueInSmallest, unit: smallestUnit };
  }

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Stok Gudang Pusat</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>
              Stok fisik real-time vs batas minimum
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input 
              className="input" 
              placeholder="Cari nama barang..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              style={{ width: 200 }} 
            />
            <Select 
              value={catFilter} 
              onChange={(val: string) => setCatFilter(val)}
              options={[
                { value: '', label: 'Semua Kategori' },
                ...categories.map(c => ({ value: String(c.id), label: c.name }))
              ]}
              style={{ width: 150 }}
            />
            <Select 
              value={statusFilter} 
              onChange={(val: string) => setStatusFilter(val)}
              options={[
                { value: '', label: 'Semua Status' },
                { value: 'SAFE', label: 'Aman' },
                { value: 'LOW', label: 'Stok Rendah' },
                { value: 'OUT', label: 'Habis' }
              ]}
              style={{ width: 140 }}
            />
          </div>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat inventaris...</div>
            ) : filteredItems.length === 0 ? (
              <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Tidak ada barang ditemukan.</div>
            ) : (
              <>
                <div className="table-responsive">
                <Table>
                  <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Barang</th>
                    <th className="right">Stok Min.</th>
                    <th className="right">Stok Fisik</th>
                    <th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map(item => {
                    const currentStockSmallest = Number(item.current_stock ?? 0);
                    const minStockSmallest = Number(item.minimum_threshold ?? 0);
                    
                    const centralStock = toCentralDisplay(currentStockSmallest, item.smallest_unit);
                    const centralMin = toCentralDisplay(minStockSmallest, item.smallest_unit);
                    
                    const isLow = currentStockSmallest < minStockSmallest;
                    const isOut = currentStockSmallest <= 0;
                    
                    return (
                      <tr key={item.id} onClick={() => setSelectedItemId(String(item.id))} className="cursor-pointer" title="Lihat Kartu Stok">
                        <td className="font-mono text-muted">ERC{String(item.id).padStart(5, '0')}</td>
                        <td className="font-bold">{item.name}</td>
                        <td className="right">
                          <div className="num font-bold">{centralMin.value.toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>{centralMin.unit}</span></div>
                          {centralMin.unit !== item.smallest_unit && <div className="muted" style={{ fontSize: 11 }}>({minStockSmallest.toLocaleString('id-ID')} {item.smallest_unit})</div>}
                        </td>
                        <td className="right">
                          <div className="num font-bold" style={{ color: isOut ? '#dc2626' : isLow ? '#d97706' : '#059669', fontSize: 14 }}>
                            {centralStock.value.toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span style={{ fontSize: 12, fontWeight: 500, color: 'inherit', opacity: 0.8 }}>{centralStock.unit}</span>
                          </div>
                          {centralStock.unit !== item.smallest_unit && <div className="muted" style={{ fontSize: 11 }}>({currentStockSmallest.toLocaleString('id-ID')} {item.smallest_unit})</div>}
                        </td>
                        <td className="center">
                          <Badge variant={isOut ? 'red' : isLow ? 'amber' : 'green'}>
                            {isOut ? 'Habis' : isLow ? 'Stok Rendah' : 'Aman'}
                          </Badge>
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
        title={`Kartu Stok — ${selectedItem?.name}`} 
        maxWidth={800}
        footer={<Button variant="outline" onClick={() => setSelectedItemId('')}>Tutup</Button>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Saldo Saat Ini</p>
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
            <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Penerimaan Terakhir (IN)</p>
            <div style={{ fontWeight: 600 }}>
              {lastIn ? new Date(lastIn).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
            </div>
          </div>
          <div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Distribusi Terakhir (OUT)</p>
            <div style={{ fontWeight: 600 }}>
              {lastOut ? new Date(lastOut).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
            </div>
          </div>
        </div>

        <div className="card-body flush" style={{ overflowY: 'visible' }}>
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data kartu stok...</div>
          ) : logs.length === 0 ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>
              Tidak ada pergerakan inventaris yang tercatat untuk barang ini.
            </div>
          ) : (
            <div className="table-responsive">
            <Table>
              <thead>
                <tr>
                  <th>Tanggal & Waktu</th>
                  <th>Jenis Mutasi</th>
                  <th className="right">Perubahan (Jml)</th>
                  <th className="right">Saldo Akhir</th>
                  <th>Referensi</th>
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
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}

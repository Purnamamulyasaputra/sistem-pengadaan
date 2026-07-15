'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/components/ui/Table';
import { Search } from 'lucide-react';

type OutletStockRow = {
  item_id: number;
  item_name: string;
  category_name: string;
  current_balance: number;
  purchase_unit: string;
  smallest_unit: string;
  minimum_threshold: number | null;
  barcode: string | null;
};

export default function OutletInventoryStockPage() {
  const [data, setData] = useState<OutletStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = (silent = false) => {
    if (!silent) setLoading(true);
    fetch('/api/outlet/inventory')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setData(json.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveMin = async (itemId: number) => {
    if (saving) return;
    setSaving(true);
    try {
      const val = parseFloat(editValue) || 0;
      const res = await fetch('/api/outlet/inventory/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, minimumThreshold: val })
      });
      if (res.ok) {
        setEditingId(null);
        fetchData(true); // reload silently
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSimulateSale = async (itemId: number) => {
    // Determine amount to subtract based on item
    const amount = 500; // Deduct 500 units for simulation
    
    // Optimistic update
    setData(prev => prev.map(d => 
      d.item_id === itemId ? { ...d, current_balance: d.current_balance - amount } : d
    ));

    try {
      await fetch('/api/outlet/inventory/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, amount })
      });
      // We don't necessarily need to reload, because the optimistic update handles it.
      // But we fetch silently just to sync any server changes
      fetchData(true);
      
      // Force update the sidebar badge by triggering a custom event or fetching alerts
      // (Since layout relies on global state, the easiest way without modifying Context 
      // is just letting the silent fetch complete, but we could trigger an event here)
      window.dispatchEvent(new Event('stock-updated'));
    } catch (e) {
      console.error(e);
      fetchData(true); // Revert on error
    }
  };

  const filteredData = search.trim() 
    ? data.filter(d => 
        d.item_name.toLowerCase().includes(search.toLowerCase()) || 
        (d.barcode && d.barcode.toLowerCase().includes(search.toLowerCase()))
      )
    : data;

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Inventory Stock Balance</h3>
            <p className="hint">Sisa stok fisik bahan baku dan operasional di outlet saat ini.</p>
          </div>
          <div style={{ position: 'relative', width: 300 }}>
            <Search style={{ position: 'absolute', left: 10, top: 8, width: 14, height: 14, color: 'var(--muted)' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: 30 }}
              placeholder="Cari nama barang atau barcode..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }} className="muted">
              Memuat data inventori...
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>CODE</th>
                  <th>ITEM</th>
                  <th style={{ width: 120 }}>PURCH. UNIT</th>
                  <th style={{ width: 120 }}>SMALL. UNIT</th>
                  <th className="right" style={{ width: 100 }}>STOCK</th>
                  <th className="right" style={{ width: 80 }}>MIN</th>
                  <th className="center" style={{ width: 100 }}>STATUS</th>
                  <th className="center" style={{ width: 110 }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(row => {
                  const isLowStock = row.minimum_threshold !== null && row.current_balance <= row.minimum_threshold;
                  return (
                    <tr key={row.item_id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--muted)', fontSize: 13 }}>
                        {row.barcode || '-'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{row.item_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{row.category_name}</div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--muted)' }}>{row.purchase_unit}</td>
                      <td style={{ fontSize: 13, color: 'var(--muted)' }}>{row.smallest_unit}</td>
                      
                      <td className="right" style={{ fontSize: 13, color: isLowStock ? 'var(--red)' : 'var(--ink)' }}>
                        {row.current_balance.toLocaleString('id-ID')} <span style={{ fontSize: 12, color: 'var(--muted)' }}>{row.smallest_unit}</span>
                      </td>
                      
                      <td className="right">
                        {editingId === row.item_id ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                            <input 
                              autoFocus
                              type="text" 
                              className="input" 
                              style={{ width: 60, textAlign: 'right', padding: '4px 6px', height: 26, fontSize: 13 }}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value.replace(/[^0-9.]/g, ''))}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveMin(row.item_id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              onBlur={() => handleSaveMin(row.item_id)}
                            />
                            <span style={{ fontSize: 11, color: 'var(--muted)', width: '35px', textAlign: 'left' }}>{row.smallest_unit}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, color: 'var(--ink)' }}>
                            {row.minimum_threshold !== null ? (
                              <>{row.minimum_threshold} <span style={{ fontSize: 12, color: 'var(--muted)' }}>{row.smallest_unit}</span></>
                            ) : (
                              <span style={{ color: 'var(--muted)' }}>-</span>
                            )}
                          </span>
                        )}
                      </td>
                      
                      <td className="center">
                        {row.current_balance <= 0 ? (
                          <span className="badge badge-danger">Habis</span>
                        ) : isLowStock ? (
                          <span className="badge" style={{ background: '#fef08a', color: '#854d0e' }}>Kurang</span>
                        ) : (
                          <span className="badge badge-success">Ada</span>
                        )}
                      </td>
                      
                      <td className="center">
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            onClick={() => handleSimulateSale(row.item_id)}
                            title="Simulasi Penjualan POS (-500)"
                            style={{
                              border: '1px solid #fed7aa',
                              background: '#fff7ed',
                              borderRadius: 4,
                              width: 26,
                              height: 26,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#ea580c'
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                          </button>
                          <button 
                            onClick={() => {
                              setEditingId(row.item_id);
                              setEditValue(row.minimum_threshold?.toString() || '0');
                            }}
                            title="Edit Minimum Stok"
                            style={{
                              border: '1px solid var(--border)',
                              background: '#fff',
                              borderRadius: 4,
                              width: 26,
                              height: 26,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: 'var(--blue)'
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 30 }} className="muted">
                      Tidak ada barang ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </section>
  );
}

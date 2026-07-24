'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';
import { Pagination } from '@/components/ui/Pagination';

interface Order {
  id: number; outlet_name: string; order_date: string; delivery_date: string;
  status: string; item_count: number; created_by_name: string;
}
interface OrderItem {
  id: number; order_id: number; item_name: string; category_name: string;
  purchase_unit: string; smallest_unit: string; qty_request: number; smallest_unit_qty: number;
  qty_approved?: number; approved_smallest_qty?: number;
  fulfillment_status: string; item_status: string; distribution_price?: number;
  additional_notes?: string; current_average_price?: number; current_stock?: number;
  conversion_ratio?: number;
}

interface AggregatedProduct {
  item_id: number;
  item_name: string;
  unit: string;
  smallest_unit?: string;
  conversion_ratio?: string;
  total_requested: string;
  central_stock: string;
}


const ITEM_STATUS_LABELS: Record<string, string> = {
  DITERIMA_DARI_OUTLET: 'Diterima dari Outlet', PROSES_BELANJA: 'Proses Belanja',
  READY_DI_GUDANG: 'Siap di Gudang', DIKIRIM: 'Dikirim', SELESAI: 'Selesai',
};

function formatDate(dateString: string) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

const getFulfillmentStyle = (val: string) => {
  if (val === 'SANGGUP') return { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0', fontWeight: 'bold' };
  if (val === 'TIDAK') return { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fecaca', fontWeight: 'bold' };
  return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0', fontWeight: 'bold' };
};

const getStatusStyle = (val: string) => {
  if (val === 'READY_DI_GUDANG') return { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0', fontWeight: 'bold' };
  if (val === 'PROSES_BELANJA') return { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde68a', fontWeight: 'bold' };
  if (val === 'SELESAI') return { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#bfdbfe', fontWeight: 'bold' };
  return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0', fontWeight: 'bold' };
};

function RequestsContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState<number | null>(null);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' as 'success' | 'error' | 'info' });
  const [viewMode, setViewMode] = useState<'by-outlet' | 'by-product'>('by-outlet');
  const [aggregatedProducts, setAggregatedProducts] = useState<AggregatedProduct[]>([]);
  const [aggCurrentPage, setAggCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const ITEMS_PER_PAGE = 25;
  const AGG_ITEMS_PER_PAGE = 20;

  const searchParams = useSearchParams();
  const openId = searchParams.get('open_id');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);

    const res = await fetch(`/api/orders?${params}`);
    const data = await res.json();
    setOrders(data.data ?? []);
    setLoading(false);
    setCurrentPage(1); // Reset to first page when fetching new data
  }, [statusFilter, startDate, endDate]);

  const fetchAggregated = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);

    const res = await fetch(`/api/orders/aggregated?${params}`);
    const data = await res.json();
    setAggregatedProducts(data.data ?? []);
    setLoading(false);
    setAggCurrentPage(1);
  }, [statusFilter, startDate, endDate]);

  useEffect(() => {
    if (viewMode === 'by-outlet') fetchOrders();
    else fetchAggregated();
  }, [viewMode, fetchOrders, fetchAggregated]);

  const handleViewOrder = useCallback(async (order: Order) => {
    setSelectedOrder({ order, items: [] });
    // Load items
    const iRes = await fetch(`/api/orders/recap?order_id=${order.id}`);
    if (iRes.ok) {
      const iData = await iRes.json();
      setSelectedOrder({ order, items: iData.data ?? [] });
    }
  }, []);

  useEffect(() => {
    if (!loading && openId && orders.length > 0) {
      const orderToOpen = orders.find(o => String(o.id) === openId);
      if (orderToOpen) {
        handleViewOrder(orderToOpen);
      }
    }
  }, [loading, openId, orders, handleViewOrder]);

  async function handleUpdateItem(orderItemId: number, updates: Record<string, unknown>) {
    setSaving(orderItemId);
    try {
      await fetch(`/api/orders/${orderItemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      fetchOrders();
      if (selectedOrder) {
        setSelectedOrder(prev => prev ? {
          ...prev,
          items: prev.items.map(i => i.id === orderItemId ? { ...i, ...updates } : i)
        } : null);
      }
    } finally { setSaving(null); }
  }



  return (
    <section className="screen">
      <Toast isOpen={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, open: false })} />
      <div className="card">
        <div className="card-head" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: '0 0 12px 0' }}>Rekap Permintaan</h3>
            <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)' }}>
              <div
                style={{ paddingBottom: 8, cursor: 'pointer', fontWeight: viewMode === 'by-outlet' ? 600 : 500, color: viewMode === 'by-outlet' ? 'var(--primary)' : 'var(--muted)', borderBottom: viewMode === 'by-outlet' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -1 }}
                onClick={() => setViewMode('by-outlet')}
              >
                Per Outlet (PO)
              </div>
              <div
                style={{ paddingBottom: 8, cursor: 'pointer', fontWeight: viewMode === 'by-product' ? 600 : 500, color: viewMode === 'by-product' ? 'var(--primary)' : 'var(--muted)', borderBottom: viewMode === 'by-product' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -1 }}
                onClick={() => setViewMode('by-product')}
              >
                Per Produk (Agregat)
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: -4 }}>
            <input
              type="text"
              className="input"
              style={{ width: 200 }}
              placeholder={viewMode === 'by-outlet' ? 'Cari PO atau Outlet...' : 'Cari nama barang...'}
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); setAggCurrentPage(1); }}
            />
            <input
              type="date"
              className="input"
              style={{ width: 140 }}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              title="Start Date"
            />
            <span className="muted">-</span>
            <input
              type="date"
              className="input"
              style={{ width: 140 }}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              title="End Date"
            />
            {viewMode === 'by-outlet' && (
              <select className="input" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">Semua Status</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Diproses</option>
                <option value="SHIPPED">Dikirim</option>
                <option value="COMPLETED">Selesai</option>
              </select>
            )}
          </div>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat data...</div>
          ) : viewMode === 'by-product' ? (
            aggregatedProducts.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /></svg>
                <h4>Tidak ada produk tertunda</h4>
                <p>Tidak ada permintaan aktif dari outlet saat ini</p>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <Table>
                    <thead>
                      <tr>
                        <th>Nama Barang</th>
                        <th className="center">Total Diminta</th>
                        <th className="center">Stok Pusat</th>
                        <th className="center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filteredAgg = aggregatedProducts.filter(p => p.item_name.toLowerCase().includes(searchQuery.toLowerCase()));
                        return filteredAgg.slice((aggCurrentPage - 1) * AGG_ITEMS_PER_PAGE, aggCurrentPage * AGG_ITEMS_PER_PAGE).map(p => {
                          const neededRaw = Number(p.total_requested) || 0;
                          const stockRaw = Number(p.central_stock) || 0;
                          const ratio = Number(p.conversion_ratio) || 1;

                          const neededPurchase = neededRaw / ratio;
                          const stockPurchase = stockRaw / ratio;

                          const isShortage = neededRaw > stockRaw;

                          const fmt = (num: number) => num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
                          const fmtRaw = (num: number) => num.toLocaleString('id-ID');

                          return (
                            <tr key={p.item_id}>
                              <td className="font-bold" style={{ padding: '4px 16px', fontSize: 13 }}>{p.item_name}</td>
                              <td className="center" style={{ padding: '4px 16px' }}>
                                <div className="font-bold text-primary" style={{ fontSize: 13 }}>{fmt(neededPurchase)} {p.unit}</div>
                                {ratio > 1 && <div className="muted" style={{ fontSize: 10 }}>({fmtRaw(neededRaw)} {p.smallest_unit})</div>}
                              </td>
                              <td className="center" style={{ padding: '4px 16px' }}>
                                <div className="text-dark" style={{ fontSize: 13 }}>{fmt(stockPurchase)} {p.unit}</div>
                                {ratio > 1 && <div className="muted" style={{ fontSize: 10 }}>({fmtRaw(stockRaw)} {p.smallest_unit})</div>}
                              </td>
                              <td className="center" style={{ padding: '4px 16px' }}>
                                {isShortage ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 6px', borderRadius: 4, background: '#fee2e2', color: '#991b1b' }}>Perlu Restock</span>
                                ) : (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 6px', borderRadius: 4, background: '#dcfce7', color: '#166534' }}>Stok Tersedia</span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </Table>
                </div>
                {(() => {
                  const filteredAgg = aggregatedProducts.filter(p => p.item_name.toLowerCase().includes(searchQuery.toLowerCase()));
                  if (filteredAgg.length <= AGG_ITEMS_PER_PAGE) return null;
                  return (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                      <Pagination
                        currentPage={aggCurrentPage}
                        totalPages={Math.ceil(filteredAgg.length / AGG_ITEMS_PER_PAGE)}
                        totalItems={filteredAgg.length}
                        itemsPerPage={AGG_ITEMS_PER_PAGE}
                        onPageChange={setAggCurrentPage}
                      />
                    </div>
                  );
                })()}
              </>
            )
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /></svg>
              <h4>Belum ada permintaan</h4>
              <p>Belum ada permintaan masuk dari outlet</p>
            </div>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <th>No. PO</th><th>Outlet</th><th>Dibuat oleh</th>
                    <th>Tanggal Order</th><th>Tanggal Kirim</th>
                    <th className="center">Barang</th><th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredOrders = orders.filter(o => 
                      o.outlet_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      `PO-${new Date(o.order_date).getFullYear()}-${String(o.id).padStart(5, '0')}`.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                    return filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(o => (
                      <tr
                        key={o.id}
                        onClick={() => handleViewOrder(o)}
                        style={{ cursor: 'pointer' }}
                        className="hover:bg-[#e6f3ec] transition-colors"
                      >
                        <td className="font-mono text-primary font-bold">PO-{new Date(o.order_date).getFullYear()}-{String(o.id).padStart(5, '0')}</td>
                        <td className="font-bold">{o.outlet_name}</td>
                        <td className="muted">{o.created_by_name}</td>
                        <td>{formatDate(o.order_date)}</td>
                        <td>{formatDate(o.delivery_date)}</td>
                        <td className="center num font-bold">{o.item_count}</td>
                        <td className="center"><OrderStatusBadge status={o.status} /></td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </Table>

              {(() => {
                const filteredOrders = orders.filter(o => 
                  o.outlet_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  `PO-${new Date(o.order_date).getFullYear()}-${String(o.id).padStart(5, '0')}`.toLowerCase().includes(searchQuery.toLowerCase())
                );
                if (filteredOrders.length <= ITEMS_PER_PAGE) return null;
                return (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                    <Pagination
                      currentPage={currentPage}
                      totalPages={Math.ceil(filteredOrders.length / ITEMS_PER_PAGE)}
                      totalItems={filteredOrders.length}
                      itemsPerPage={ITEMS_PER_PAGE}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Detail Permintaan PO-${selectedOrder ? new Date(selectedOrder.order.order_date).getFullYear() + '-' + String(selectedOrder.order.id).padStart(5, '0') : ''}`} maxWidth={1100}>
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p className="muted" style={{ margin: 0 }}>{selectedOrder?.order?.outlet_name}: {selectedOrder ? formatDate(selectedOrder.order.order_date) : ''}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedOrder?.items?.some(i => i.fulfillment_status === 'SANGGUP') && (
                <Link href={`/delivery-orders/create?order_id=${selectedOrder.order.id}`} style={{ textDecoration: 'none' }}>
                  <Button variant="outline" size="sm" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                    Kirim ke Outlet
                  </Button>
                </Link>
              )}
              <Button variant="primary" size="sm" onClick={() => setSelectedOrder(null)}>Tutup</Button>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {selectedOrder?.items?.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                Data barang kosong atau tidak ditemukan.
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Barang</th><th>Kategori</th><th className="right">Jml Diminta</th>
                    <th className="right">Jml Disetujui</th>
                    <th className="right">Stok Saat Ini</th>
                    <th>Pemenuhan</th><th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder?.items?.map(item => (
                    <tr key={item.id}>
                      <td className="font-bold">{item.item_name}</td>
                      <td className="muted">{item.category_name}</td>
                      <td className="right">
                        <div className="muted num" style={{ fontSize: 13 }}>{parseFloat(Number(item.qty_request).toFixed(3)).toLocaleString('id-ID')} {item.purchase_unit}</div>
                      </td>
                      <td className="right">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          <input 
                            type="number"
                            className="input right font-bold"
                            style={{ width: 70, height: 28, padding: '2px 8px' }}
                            defaultValue={item.qty_approved ?? item.qty_request}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0) {
                                handleUpdateItem(item.id, { 
                                  qty_approved: val,
                                  approved_smallest_qty: val * Number(item.conversion_ratio || 1)
                                });
                              }
                            }}
                          />
                          <span style={{ fontSize: 13 }}>{item.purchase_unit}</span>
                        </div>
                      </td>
                      <td className="right">
                        <div className="font-bold num" style={{ color: Number(item.current_stock) >= (item.approved_smallest_qty ?? item.smallest_unit_qty) ? '#166534' : '#991b1b' }}>
                          {parseFloat((Number(item.current_stock ?? 0) / Number(item.conversion_ratio || 1)).toFixed(3)).toLocaleString('id-ID')} {item.purchase_unit}
                        </div>
                      </td>
                      <td>
                        <select
                          className="input"
                          style={{ height: 30, padding: '2px 8px', ...getFulfillmentStyle(item.fulfillment_status) }}
                          value={item.fulfillment_status}
                          onChange={e => handleUpdateItem(item.id, { fulfillment_status: e.target.value })}
                        >
                          <option value="MENUNGGU">Menunggu</option>
                          <option value="SANGGUP">Sanggup</option>
                          <option value="TIDAK">Tidak</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="input"
                          style={{ height: 30, padding: '2px 8px', ...getStatusStyle(item.item_status) }}
                          value={item.item_status}
                          onChange={e => handleUpdateItem(item.id, { item_status: e.target.value })}
                        >
                          {Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>
                      <td>
                        {saving === item.id && <span className="muted" style={{ fontSize: 11 }}>...</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<div className="screen" style={{ padding: 40, textAlign: 'center' }}>Memuat...</div>}>
      <RequestsContent />
    </Suspense>
  );
}

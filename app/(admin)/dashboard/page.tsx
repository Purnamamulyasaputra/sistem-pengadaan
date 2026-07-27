import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getUnresolvedAlertCount } from '@/lib/queries/alerts';
import { getInventoryValueTrend } from '@/lib/queries/inventory';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';
import TableRowLink from '@/components/shared/TableRowLink';
import { DashboardChart } from '@/components/ui/DashboardChart';
import { OutletTrendChart } from '@/components/ui/OutletTrendChart';

async function getDashboardStats(role: string, outletId: number | null) {
  try {
    const [ordersRes, poRes, itemsRes, alertsRes, stockValRes] = await Promise.all([
      query(
        role === 'ADMIN_PUSAT'
          ? `SELECT status, COUNT(*)::int AS cnt FROM orders GROUP BY status`
          : `SELECT status, COUNT(*)::int AS cnt FROM orders WHERE outlet_id = $1 GROUP BY status`,
        role === 'ADMIN_PUSAT' ? [] : [outletId]
      ),
      role === 'ADMIN_PUSAT' 
        ? query(`SELECT COUNT(*)::int AS cnt FROM purchase_orders WHERE status IN ('DRAFT', 'RFQ_TERKIRIM')`) 
        : Promise.resolve({ rows: [{ cnt: 0 }] }),
      query(`SELECT COUNT(*)::int AS cnt FROM items WHERE is_active = TRUE`),
      role === 'ADMIN_PUSAT' ? query(`SELECT COUNT(*)::int AS cnt FROM stock_alerts WHERE is_resolved = FALSE`) : Promise.resolve({ rows: [{ cnt: 0 }] }),
      role === 'ADMIN_PUSAT' ? query(`SELECT COALESCE(SUM(i.current_average_price * il.ending_balance), 0)::numeric AS total_value FROM items i LEFT JOIN LATERAL (SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC LIMIT 1) il ON true WHERE i.is_active = TRUE`) : Promise.resolve({ rows: [{ total_value: 0 }] }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of ordersRes.rows) {
      statusMap[row.status] = row.cnt;
    }

    return {
      ordersPending: statusMap['PENDING'] ?? 0,
      ordersProcessing: statusMap['PROCESSING'] ?? 0,
      ordersShipped: statusMap['SHIPPED'] ?? 0,
      ordersCompleted: statusMap['COMPLETED'] ?? 0,
      vendorOrdersPending: poRes.rows[0]?.cnt ?? 0,
      totalItems: itemsRes.rows[0]?.cnt ?? 0,
      unresolvedAlerts: alertsRes.rows[0]?.cnt ?? 0,
      stockValue: parseFloat(stockValRes.rows[0]?.total_value ?? '0'),
    };
  } catch {
    return { ordersPending: 0, ordersProcessing: 0, ordersShipped: 0, ordersCompleted: 0, vendorOrdersPending: 0, totalItems: 0, unresolvedAlerts: 0, stockValue: 0 };
  }
}

async function getRecentOrders(role: string, outletId: number | null) {
  try {
    const result = await query(
      role === 'ADMIN_PUSAT'
        ? `SELECT o.id, o.status, o.order_date, o.delivery_date, outlet.name AS outlet_name, u.name AS created_by_name
           FROM orders o
           LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
           LEFT JOIN users u ON u.id = o.created_by
           ORDER BY o.created_at DESC LIMIT 5`
        : `SELECT o.id, o.status, o.order_date, o.delivery_date, outlet.name AS outlet_name, u.name AS created_by_name
           FROM orders o
           LEFT JOIN outlets outlet ON outlet.id = o.outlet_id
           LEFT JOIN users u ON u.id = o.created_by
           WHERE o.outlet_id = $1
           ORDER BY o.created_at DESC LIMIT 5`,
      role === 'ADMIN_PUSAT' ? [] : [outletId]
    );
    return result.rows;
  } catch { return []; }
}

async function getRecentAlerts() {
  try {
    const result = await query(
      `SELECT sa.*, i.name AS item_name, i.smallest_unit,
              (SELECT ending_balance FROM inventory_logs WHERE item_id = i.id ORDER BY created_at DESC LIMIT 1) AS current_balance
       FROM stock_alerts sa
       LEFT JOIN items i ON i.id = sa.item_id
       WHERE sa.is_resolved = FALSE
       ORDER BY sa.created_at DESC LIMIT 5`
    );
    return result.rows;
  } catch { return []; }
}

async function getIncomingPOs() {
  try {
    const result = await query(
      `SELECT po.id, po.po_number, v.name as vendor_name, po.order_deadline, po.status 
       FROM purchase_orders po 
       LEFT JOIN vendors v ON v.id = po.vendor_id 
       WHERE po.status IN ('DRAFT', 'RFQ_TERKIRIM') 
       ORDER BY po.order_deadline ASC NULLS LAST LIMIT 5`
    );
    return result.rows;
  } catch { return []; }
}

async function getFastMovingItems() {
  try {
    const result = await query(
      `SELECT i.name, i.smallest_unit, SUM(ABS(il.qty_change)) as total_out
       FROM inventory_logs il
       JOIN items i ON i.id = il.item_id
       WHERE il.movement_type = 'OUT' AND il.created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY i.id, i.name, i.smallest_unit
       ORDER BY total_out DESC
       LIMIT 5`
    );
    return result.rows;
  } catch { return []; }
}

async function getPendingIssues() {
  try {
    const result = await query(
      `SELECT i.id, dn.dn_number, o.name as outlet_name, i.issue_type, i.status, i.created_at
       FROM delivery_note_issues i
       JOIN delivery_notes dn ON dn.id = i.delivery_note_id
       JOIN outlets o ON o.id = dn.destination_outlet_id
       WHERE i.status = 'PENDING'
       ORDER BY i.created_at DESC LIMIT 5`
    );
    return result.rows;
  } catch { return []; }
}

async function getOutletIssues(outletId: number | null) {
  if (!outletId) return [];
  try {
    const result = await query(
      `SELECT i.id, dn.dn_number, i.issue_type, i.status, i.created_at
       FROM delivery_note_issues i
       JOIN delivery_notes dn ON dn.id = i.delivery_note_id
       WHERE dn.destination_outlet_id = $1
       ORDER BY i.created_at DESC LIMIT 5`,
      [outletId]
    );
    return result.rows;
  } catch { return []; }
}

async function getOutletLowStock(outletId: number | null) {
  if (!outletId) return [];
  try {
    const result = await query(
      `SELECT i.id, i.name, i.smallest_unit, 
              COALESCE(os.current_balance, 0)::numeric AS current_balance, 
              ois.minimum_threshold
       FROM items i
       JOIN outlet_item_settings ois ON ois.item_id = i.id AND ois.outlet_id = $1
       LEFT JOIN outlet_stocks os ON os.item_id = i.id AND os.outlet_id = $1
       WHERE i.is_active = TRUE AND COALESCE(os.current_balance, 0) <= ois.minimum_threshold
       ORDER BY current_balance ASC LIMIT 5`,
      [outletId]
    );
    return result.rows;
  } catch { return []; }
}

async function getOutletOrderTrend(outletId: number | null) {
  if (!outletId) return [];
  try {
    const result = await query(
      `WITH dates AS (
         SELECT generate_series(
           CURRENT_DATE - INTERVAL '6 days', 
           CURRENT_DATE, 
           '1 day'::interval
         )::date AS dt
       )
       SELECT to_char(d.dt, 'DD Mon') as labelDate, 
              COALESCE(COUNT(o.id), 0)::int as count
       FROM dates d
       LEFT JOIN orders o ON DATE(o.created_at) = d.dt AND o.outlet_id = $1
       GROUP BY d.dt
       ORDER BY d.dt ASC`,
      [outletId]
    );
    return result.rows.map(r => ({ labelDate: r.labeldate, value: r.count }));
  } catch { return []; }
}

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID').format(Math.round(n));
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [stats, recentOrders, recentAlerts, incomingPOs, fastMoving, pendingIssues, outletIssues, outletLowStock, outletTrend] = await Promise.all([
    getDashboardStats(session.role, session.outletId),
    getRecentOrders(session.role, session.outletId),
    session.role === 'ADMIN_PUSAT' ? getRecentAlerts() : Promise.resolve([]),
    session.role === 'ADMIN_PUSAT' ? getIncomingPOs() : Promise.resolve([]),
    session.role === 'ADMIN_PUSAT' ? getFastMovingItems() : Promise.resolve([]),
    session.role === 'ADMIN_PUSAT' ? getPendingIssues() : Promise.resolve([]),
    session.role !== 'ADMIN_PUSAT' ? getOutletIssues(session.outletId) : Promise.resolve([]),
    session.role !== 'ADMIN_PUSAT' ? getOutletLowStock(session.outletId) : Promise.resolve([]),
    session.role !== 'ADMIN_PUSAT' ? getOutletOrderTrend(session.outletId) : Promise.resolve([]),
  ]);

  const trendData = session.role === 'ADMIN_PUSAT' ? await getInventoryValueTrend(stats.stockValue) : [];

  const isCentral = session.role === 'ADMIN_PUSAT';

  return (
    <section className="screen">
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">Order Minggu Ini</div>
          <div className="kpi-value">{fmt(stats.ordersPending + stats.ordersProcessing + stats.ordersShipped + stats.ordersCompleted)}</div>
          <div className="kpi-note">dari outlet</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Perlu Konfirmasi</div>
          <div className="kpi-value">{fmt(stats.ordersPending)}</div>
          <div className="kpi-note">{stats.ordersPending > 0 ? 'menunggu' : '✓ Tidak ada'}</div>
        </div>
        {isCentral ? (
          <>
            <div className="kpi-card">
              <div className="kpi-label">Proses Pembelian</div>
              <div className="kpi-value">{fmt(stats.vendorOrdersPending)}</div>
              <div className="kpi-note">tunggu vendor / krm</div>
            </div>
            <Link href="/alerts" style={{ textDecoration: 'none' }} className={`kpi-card ${stats.unresolvedAlerts > 0 ? 'alert' : ''}`}>
              <div className="kpi-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:4}}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                Titik Pemesanan
              </div>
              <div className="kpi-value">{fmt(stats.unresolvedAlerts)}</div>
              <div className="kpi-note">brg &le; min stok</div>
            </Link>
          </>
        ) : (
          <>
            <div className="kpi-card">
              <div className="kpi-label">Proses Pengiriman</div>
              <div className="kpi-value">{fmt(stats.ordersShipped)}</div>
              <div className="kpi-note">sedang dikirim</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total Order Selesai</div>
              <div className="kpi-value">{fmt(stats.ordersCompleted)}</div>
              <div className="kpi-note">✓ Selesai</div>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>{isCentral ? 'Tren Nilai Inventaris' : 'Aktivitas Permintaan (7 Hari Terakhir)'}</h3>
          </div>
        </div>
        <div className="card-body">
          {isCentral ? <DashboardChart data={trendData} /> : <OutletTrendChart data={outletTrend} />}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px', alignItems: 'start' }}>
        
        {/* KOLOM KIRI: Beban Kerja, Rekap Outlet, Retur */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 1. Simulator Beban Kerja (PUSAT) */}
          {isCentral && (stats.ordersPending > 0 || stats.ordersProcessing > 0) && (
            <div className="card" style={{ margin: 0, borderLeft: '4px solid var(--red)' }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ background: 'var(--red-light)', color: 'var(--red)', width: '48px', height: '48px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px', fontFamily: 'Cabin, sans-serif', flexShrink: 0 }}>
                  {stats.ordersPending + stats.ordersProcessing}
                </div>
                <div>
                  <div style={{ color: 'var(--ink)', fontWeight: 700, fontSize: '14px' }}>Beban Kerja Surat Jalan</div>
                  <div style={{ color: 'var(--muted)', fontSize: '12.5px', marginTop: '4px' }}>Menunggu untuk disiapkan dan dikirim ke outlet.</div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Rekap Status Order */}
          <div className="card" style={{ margin: 0 }}>
            <div className="card-head">
              <div>
                <h3>{isCentral ? 'Rekap Status Order per Outlet' : 'Riwayat Permintaan Saya'}</h3>
              </div>
            </div>
            <div className="card-body flush">
              {recentOrders.length === 0 ? (
                <div className="empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/></svg>
                  <h4>Belum ada permintaan</h4>
                  <p>Data tidak ditemukan</p>
                </div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>No. Order</th>
                      {isCentral && <th>Outlet</th>}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order: any) => {
                      return (
                        <TableRowLink key={order.id} href={`/requests?open_id=${order.id}`} className="hover-row">
                          <td className="font-mono text-primary font-bold">RO-{String(order.id).padStart(4, '0')}</td>
                          {isCentral && <td className="font-bold">{order.outlet_name}</td>}
                          <td className="center"><OrderStatusBadge status={order.status} /></td>
                        </TableRowLink>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </div>
          </div>

          {/* 3. Notifikasi Retur/Masalah (PUSAT) */}
          {isCentral && pendingIssues.length > 0 && (
            <div className="card" style={{ margin: 0 }}>
              <div className="card-head">
                <div>
                  <h3 style={{ color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                    Retur / Masalah (Menunggu)
                  </h3>
                </div>
              </div>
              <div className="card-body flush">
                <Table>
                  <thead>
                    <tr>
                      <th>Surat Jalan</th>
                      <th>Masalah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingIssues.map((issue: any) => (
                      <tr key={issue.id}>
                        <td>
                          <div className="font-bold">{issue.dn_number}</div>
                          <div className="muted" style={{ fontSize: '11px' }}>{issue.outlet_name}</div>
                        </td>
                        <td>{issue.issue_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}

          {/* 4. Stok Outlet Menipis (OUTLET) */}
          {!isCentral && (
            <div className="card" style={{ margin: 0 }}>
              <div className="card-head">
                <div>
                  <h3 style={{ color: 'var(--red)' }}>Peringatan Stok Dapur</h3>
                  <p>Bahan yang hampir habis di outlet Anda.</p>
                </div>
              </div>
              <div className="card-body flush">
                {outletLowStock.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 0' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 13l4 4L19 7"/></svg>
                    <h4>Stok Dapur Aman</h4>
                    <p>Semua bahan baku Anda di atas batas minimum.</p>
                  </div>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th>Barang</th>
                        <th>Sisa</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outletLowStock.map((stock: any) => (
                        <tr key={stock.id}>
                          <td className="font-bold">{stock.name}</td>
                          <td style={{ color: 'var(--red)', fontWeight: 'bold' }}>{stock.current_balance} {stock.smallest_unit}</td>
                          <td>
                            <Link href="/requests/new" className="btn btn-primary btn-sm">+ Pesan</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>
          )}

        </div>

        {/* KOLOM KANAN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* 5. Status Retur Saya (OUTLET) */}
          {!isCentral && (
            <div className="card" style={{ margin: 0 }}>
              <div className="card-head">
                <div>
                  <h3>Tiket Komplain / Retur Saya</h3>
                </div>
              </div>
              <div className="card-body flush">
                {outletIssues.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 0' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                    <h4>Bebas Komplain</h4>
                    <p>Tidak ada riwayat tiket masalah baru-baru ini.</p>
                  </div>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th>Surat Jalan</th>
                        <th>Keluhan</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outletIssues.map((issue: any) => (
                        <TableRowLink key={issue.id} href="/returns">
                          <td className="font-mono text-primary font-bold">{issue.dn_number}</td>
                          <td>{issue.issue_type}</td>
                          <td><span className={`badge ${issue.status === 'PENDING' ? 'badge-amber' : 'badge-green'}`}>{issue.status}</span></td>
                        </TableRowLink>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>
          )}
        
        {isCentral && (
          <>
            
            {/* 6. Top Fast Moving (PUSAT) */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-head">
                <div>
                  <h3>Top 5 Terlaris Minggu Ini (Keluar)</h3>
                </div>
              </div>
              <div className="card-body">
                {fastMoving.length === 0 ? (
                   <div className="empty-state" style={{ padding: '24px 0' }}>
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                     <h4>Belum ada pengeluaran</h4>
                     <p>Data distribusi minggu ini kosong</p>
                   </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {fastMoving.map((item: any, idx: number) => {
                      const maxOut = parseFloat(fastMoving[0].total_out);
                      const currentOut = parseFloat(item.total_out);
                      const pct = Math.round((currentOut / maxOut) * 100);
                      return (
                        <div key={idx}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                            <span className="font-bold">{item.name}</span>
                            <span className="muted font-mono">{currentOut} {item.smallest_unit}</span>
                          </div>
                          <div style={{ width: '100%', background: 'var(--gray-light)', height: '6px', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, background: 'var(--primary)', height: '100%', borderRadius: '4px' }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 5. Incoming Deliveries (Vendor) */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-head">
                <div>
                  <h3>Kedatangan Barang (Vendor)</h3>
                </div>
              </div>
              <div className="card-body flush">
                {incomingPOs.length === 0 ? (
                  <div style={{ padding: '16px', fontSize: '13px' }} className="muted">Tidak ada jadwal kedatangan barang terdekat.</div>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th>No PO</th>
                        <th>Vendor</th>
                        <th>Tenggat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incomingPOs.map((po: any) => (
                        <TableRowLink key={po.id} href={`/purchase-orders/${po.id}`}>
                          <td className="font-mono text-primary font-bold">{po.po_number}</td>
                          <td className="font-bold">{po.vendor_name || 'Tanpa Vendor'}</td>
                          <td className="muted">{po.order_deadline ? fmtDate(po.order_deadline) : '-'}</td>
                        </TableRowLink>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>

            {/* 8. Stok Kritis (PUSAT) */}
            {recentAlerts.length > 0 && (
              <div className="card" style={{ margin: 0, border: '1px solid #fed7aa' }}>
                <div className="card-head" style={{ background: '#fff7ed' }}>
                  <div>
                    <h3 style={{ color: '#c2410c' }}>Peringatan Stok Kritis Pusat</h3>
                  </div>
                </div>
                <div className="card-body flush">
                  <Table>
                    <thead>
                      <tr>
                        <th>Barang</th>
                        <th>Sisa Stok</th>
                        <th>Batas Min</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAlerts.map((alert: any) => (
                        <tr key={alert.id}>
                          <td className="font-bold">{alert.item_name}</td>
                          <td style={{ color: 'var(--red)', fontWeight: 'bold' }}>{alert.current_balance} {alert.smallest_unit}</td>
                          <td className="muted">{alert.min_stock} {alert.smallest_unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            )}

          </>
        )}
        </div>
      </div>
    </section>
  );
}

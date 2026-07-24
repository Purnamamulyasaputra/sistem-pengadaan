import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getUnresolvedAlertCount } from '@/lib/queries/alerts';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/shared/OrderStatusBadge';
import TableRowLink from '@/components/shared/TableRowLink';

async function getDashboardStats(role: string, outletId: number | null) {
  try {
    const [ordersRes, itemsRes, alertsRes, stockValRes] = await Promise.all([
      query(
        role === 'ADMIN_PUSAT'
          ? `SELECT status, COUNT(*)::int AS cnt FROM orders GROUP BY status`
          : `SELECT status, COUNT(*)::int AS cnt FROM orders WHERE outlet_id = $1 GROUP BY status`,
        role === 'ADMIN_PUSAT' ? [] : [outletId]
      ),
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
      totalItems: itemsRes.rows[0]?.cnt ?? 0,
      unresolvedAlerts: alertsRes.rows[0]?.cnt ?? 0,
      stockValue: parseFloat(stockValRes.rows[0]?.total_value ?? '0'),
    };
  } catch {
    return { ordersPending: 0, ordersProcessing: 0, ordersShipped: 0, ordersCompleted: 0, totalItems: 0, unresolvedAlerts: 0, stockValue: 0 };
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

  const [stats, recentOrders, recentAlerts] = await Promise.all([
    getDashboardStats(session.role, session.outletId),
    getRecentOrders(session.role, session.outletId),
    session.role === 'ADMIN_PUSAT' ? getRecentAlerts() : Promise.resolve([]),
  ]);

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
              <div className="kpi-value">{fmt(stats.ordersProcessing + stats.ordersShipped)}</div>
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

      {isCentral && (
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Tren Nilai Inventaris</h3>
            </div>
          </div>
          <div className="card-body">
            {stats.stockValue > 0 ? (
              <>
                <svg className="chart-animate" viewBox="0 0 640 120" style={{width:'100%', height:'100px'}} preserveAspectRatio="none">
                  <line x1="0" y1="20" x2="640" y2="20" stroke="#e1e8e3" strokeWidth="1" />
                  <line x1="0" y1="50" x2="640" y2="50" stroke="#e1e8e3" strokeWidth="1" />
                  <line x1="0" y1="80" x2="640" y2="80" stroke="#e1e8e3" strokeWidth="1" />
                  <line x1="0" y1="110" x2="640" y2="110" stroke="#e1e8e3" strokeWidth="1" />
                  <polyline className="chart-line" points="0,90 90,70 180,80 270,55 360,65 450,40 540,45 640,25" fill="none" stroke="#016e3f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline className="chart-line delay1" points="0,110 90,105 180,108 270,95 360,103 450,88 540,98 640,82" fill="none" stroke="#c0392b" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" />
                  <circle className="chart-dot d1" cx="640" cy="25" r="3.5" fill="#016e3f" />
                  <circle className="chart-dot d2" cx="640" cy="82" r="3.5" fill="#c0392b" />
                </svg>
                <div className="chart-legend" style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><i style={{background:'#016e3f', width: 12, height: 12, borderRadius: 2}}></i>Distribusi Normal</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><i style={{background:'#c0392b', width: 12, height: 12, borderRadius: 2}}></i>Penyesuaian Pusat</span>
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3v18h18M18 17l-5-5-4 4-5-5"/></svg>
                <h4>Data tidak tersedia</h4>
                <p>Data inventaris tidak cukup untuk menampilkan tren</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
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
                  <th>Tanggal Order</th>
                  <th>Tanggal Kirim</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order: any) => {
                  return (
                    <TableRowLink key={order.id} href={`/requests?open_id=${order.id}`} className="hover-row">
                      <td className="font-mono text-primary font-bold">PO-{String(order.id).padStart(4, '0')}</td>
                      {isCentral && <td className="font-bold">{order.outlet_name}</td>}
                      <td>{fmtDate(order.order_date)}</td>
                      <td className="muted">{fmtDate(order.delivery_date)}</td>
                      <td className="center"><OrderStatusBadge status={order.status} /></td>
                    </TableRowLink>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </section>
  );
}

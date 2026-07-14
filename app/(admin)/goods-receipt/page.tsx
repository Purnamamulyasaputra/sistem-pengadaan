import { getPurchaseOrders } from '@/lib/queries/purchase-orders';
import Link from 'next/link';

export default async function WarehousePage() {
  // Fetch all POs, then filter in memory for simplicity or we can pass a specific param if our query supports it
  // Our getPurchaseOrders supports opts.status, but we need multiple statuses.
  // We'll just fetch all and filter for now.
  const allPOs = await getPurchaseOrders();
  
  const pendingReceipts = allPOs.filter(po => 
    po.status === 'PURCHASE_ORDER' || po.status === 'DITERIMA_SEBAGIAN'
  );
  
  const completedReceipts = allPOs.filter(po => po.status === 'SELESAI');

  return (
    <section className="screen">
      <div className="card">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <a href="/purchase-orders" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Purchase Orders</a>
          <a href="/goods-receipt" className="tab active" style={{ textDecoration: 'none' }}>Goods Receipt</a>
        </div>
        <div className="card-head">
          <div>
            <h3>Goods Receipt</h3>
            <p className="muted" style={{ margin: 0, marginTop: 4 }}>Kelola penerimaan barang dari vendor (Surat Jalan Masuk)</p>
          </div>
        </div>

        <h4 style={{ padding: '0 24px', marginTop: 16, marginBottom: 8, color: '#475569' }}>Menunggu Penerimaan</h4>
        {pendingReceipts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <p>Tidak ada pengiriman dari vendor yang sedang ditunggu.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>NO PO</th>
                <th>VENDOR</th>
                <th>TANGGAL ORDER</th>
                <th>DEADLINE</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {pendingReceipts.map(po => (
                <tr key={po.id}>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{po.po_number}</td>
                  <td>{po.vendor_name}</td>
                  <td>{new Date(po.order_date).toLocaleDateString('id-ID')}</td>
                  <td>{po.order_deadline ? new Date(po.order_deadline).toLocaleDateString('id-ID') : '—'}</td>
                  <td>
                    <span style={{ 
                      background: po.status === 'DITERIMA_SEBAGIAN' ? '#fef08a' : '#bfdbfe',
                      color: po.status === 'DITERIMA_SEBAGIAN' ? '#854d0e' : '#1e40af',
                      padding: '4px 8px', borderRadius: 16, fontSize: 12, fontWeight: 600
                    }}>
                      {po.status === 'DITERIMA_SEBAGIAN' ? 'Parsial' : 'Menunggu'}
                    </span>
                  </td>
                  <td>
                    <Link href={`/goods-receipt/receipt/${po.id}`}>
                      <button className="btn btn-sm" style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
                        Terima Barang
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h4 style={{ padding: '0 24px', marginTop: 32, marginBottom: 8, color: '#475569' }}>Riwayat Selesai</h4>
        <table className="data-table">
            <thead>
              <tr>
                <th>NO PO</th>
                <th>VENDOR</th>
                <th>TANGGAL ORDER</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {completedReceipts.slice(0, 5).map(po => (
                <tr key={po.id}>
                  <td style={{ fontWeight: 600 }}>{po.po_number}</td>
                  <td>{po.vendor_name}</td>
                  <td>{new Date(po.order_date).toLocaleDateString('id-ID')}</td>
                  <td>
                    <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: 16, fontSize: 12, fontWeight: 600 }}>
                      Selesai
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>
    </section>
  );
}

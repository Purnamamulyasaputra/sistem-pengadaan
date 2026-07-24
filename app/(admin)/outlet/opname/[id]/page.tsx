'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { HelpCircle } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';

export default function OutletOpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [header, setHeader] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [details, setDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [limit, setLimit] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchOpname = useCallback(async () => {
    setLoading(true);
    // Fetch header
    const hRes = await fetch(`/api/opname/${id}`);
    let locId = 1;
    if (hRes.ok) {
      const hData = await hRes.json();
      setHeader(hData.data);
      setIsLocked(hData.data?.status === 'LOCKED');
      if (hData.data?.location_id) locId = hData.data.location_id;
    }
    
    // Fetch all items for input
    const iRes = await fetch(`/api/opname/items?location_type=OUTLET&location_id=${locId}`);
    const iData = await iRes.json();
    setItems(iData.data ?? []);

    // Fetch existing details for this session
    const dRes = await fetch(`/api/opname/${id}/detail`);
    const dData = await dRes.json();
    setDetails(dData.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchOpname(); }, [fetchOpname]);

  const getDetail = (itemId: number) => details.find(d => d.item_id === itemId);

  const handleQtyChange = (itemId: number, systemBalance: number, actualQty: string) => {
    if (isLocked) return;
    const numericVal = actualQty.replace(/[^0-9.]/g, '');
    const qty = numericVal === '' ? systemBalance : parseFloat(numericVal);

    const existing = details.find(d => d.item_id === itemId);
    if (existing) {
      setDetails(details.map(d => d.item_id === itemId ? { ...d, actual_physical_qty: numericVal, variance: qty - systemBalance } : d));
    } else {
      setDetails([...details, { item_id: itemId, system_balance: systemBalance, actual_physical_qty: numericVal, variance: qty - systemBalance }]);
    }
  };

  const handleSave = async (submit: boolean = false) => {
    setSaving(true);
    try {
      // Upsert all details
      for (const detail of details) {
        const payload = {
          ...detail,
          actual_physical_qty: detail.actual_physical_qty === '' ? detail.system_balance : parseFloat(detail.actual_physical_qty)
        };
        await fetch(`/api/opname/${id}/detail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (submit) {
        // Lock the opname session
        const res = await fetch(`/api/opname/${id}/lock`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alert('Stock Opname berhasil dikunci.');
          fetchOpname();
        } else {
          alert(data.message || 'Gagal mengunci opname.');
        }
      } else {
        alert('Draft berhasil disimpan.');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Memuat data opname...</div>;
  if (!header) return <div style={{ padding: 40, textAlign: 'center' }}>Sesi tidak ditemukan.</div>;

  const paginatedItems = limit === 'all' ? items : items.slice((currentPage - 1) * limit, currentPage * limit);
  const totalPages = limit === 'all' ? 1 : Math.ceil(items.length / limit);

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Detail Opname — {new Date(header.count_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</h3>
            <div style={{ marginTop: 8, display: 'flex', gap: 16, alignItems: 'center' }}>
              <Badge variant={isLocked ? 'green' : header.status === 'SUBMITTED' ? 'blue' : 'gray'}>{header.status}</Badge>
              <span className="muted" style={{ fontSize: 13 }}>
                <span className="font-bold">Mulai:</span> {new Date(header.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="muted" style={{ fontSize: 13 }}>
                <span className="font-bold">Terakhir Diubah:</span> {new Date(header.updated_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Select 
              value={limit}
              onChange={(val) => { setLimit(val); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'Semua' },
                { value: 8, label: '8' },
                { value: 32, label: '32' }
              ]}
              inputStyle={{ padding: '4px 10px', height: 32, fontSize: 13, minWidth: 90 }}
              style={{ width: 100 }}
            />
            {!isLocked && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>Simpan Draft</Button>
                <Button variant="primary" size="sm" onClick={() => {
                  if (confirm('Apakah Anda yakin ingin mengunci sesi ini? Data tidak dapat diubah setelah dikunci.')) {
                    handleSave(true);
                  }
                }} disabled={saving}>
                  Kunci & Submit
                </Button>
              </>
            )}
            <Link href="/outlet/opname">
              <Button variant="outline" size="sm">Kembali</Button>
            </Link>
          </div>
        </div>
        
        <div className="card-body flush">
          <Table>
            <thead>
              <tr>
                <th>Nama Barang</th>
                <th>Kategori</th>
                <th className="right">Stok Sistem</th>
                <th className="right" style={{ width: 140 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    Stok Fisik
                    <span title="Barang tanpa inputan akan otomatis dianggap memiliki selisih (variance) 0." style={{ display: 'inline-flex', cursor: 'help' }}>
                      <HelpCircle size={14} className="muted" />
                    </span>
                  </div>
                </th>
                <th className="right">Selisih</th>
                <th className="right">Est. Biaya Pemakaian</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => {
                const detail = getDetail(item.item_id);
                const actual = detail ? detail.actual_physical_qty : '';
                const variance = detail ? detail.variance : 0;
                // Cost calculation: absolute variance * current average price
                const cost = Math.abs(variance) * Number(item.current_average_price);
                
                return (
                  <tr key={item.item_id}>
                    <td className="font-bold">{item.item_name}</td>
                    <td className="muted">{item.category_name}</td>
                    <td className="right num">{Number(item.system_balance).toLocaleString('id-ID', { maximumFractionDigits: 0 })} {item.smallest_unit}</td>
                    <td className="right">
                      <input 
                        type="text" 
                        className="input right" 
                        value={actual} 
                        onChange={(e) => handleQtyChange(item.item_id, item.system_balance, e.target.value)} 
                        disabled={isLocked}
                        placeholder="0"
                        style={{ height: 32, width: '100%', borderColor: actual === '' ? '#fca5a5' : 'var(--border)' }} 
                      />
                    </td>
                    <td className="right num">
                      {variance !== 0 ? (
                        <span style={{ color: variance > 0 ? 'var(--primary)' : '#dc2626', fontWeight: 600 }}>
                          {variance > 0 ? '+' : ''}{variance.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="right num font-mono muted">
                      Rp {cost.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={items.length}
              itemsPerPage={limit as number}
              onPageChange={setCurrentPage}
            />
          )}
          
        </div>
      </div>
    </section>
  );
}

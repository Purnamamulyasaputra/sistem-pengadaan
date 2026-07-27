'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';

const REASON_CATEGORIES = [
  { value: 'RUSAK', label: 'Rusak' },
  { value: 'KADALUARSA', label: 'Kadaluarsa' },
  { value: 'SALAH_CATAT', label: 'Salah Catat' },
  { value: 'HILANG_SUSUT', label: 'Hilang / Susut' },
  { value: 'LAINNYA', label: 'Lainnya' },
];

function formatUnit(unit: string | null | undefined): string {
  if (!unit) return '';
  const u = unit.toLowerCase().trim();
  if (u === 'l') return 'Liter';
  if (u === 'g' || u === 'gr') return 'gram';
  return unit;
}


export default function OutletOpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [header, setHeader] = useState<any>(null);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [details, setDetails] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [limit, setLimit] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({ message: '', type: 'info', isOpen: false });
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, isOpen: true });
  };

  const fetchOpname = useCallback(async () => {
    setLoading(true);
    // Fetch header
    const hRes = await fetch(`/api/opname/${id}`);
    if (hRes.ok) {
      const hData = await hRes.json();
      setHeader(hData.data);
      setIsLocked(hData.data?.status === 'LOCKED');
      
      if (hData.data?.location_id) {
        // Fetch all items for input
        const iRes = await fetch(`/api/opname/items?location_type=OUTLET&location_id=${hData.data.location_id}`);
        const iData = await iRes.json();
        setItems(iData.data ?? []);
      }
    }

    // Fetch existing details for this session
    const dRes = await fetch(`/api/opname/${id}/detail`);
    const dData = await dRes.json();
    setDetails(dData.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchOpname(); }, [fetchOpname]);

  const getDetail = (itemId: number) => details.find(d => d.item_id === itemId);

  const handleQtyChange = (itemId: number, systemBalance: number, ratio: number, actualQtyLarge: string) => {
    if (isLocked) return;
    const qtyLarge = parseFloat(actualQtyLarge);
    if (isNaN(qtyLarge)) return;

    const qtySmall = qtyLarge * (ratio || 1);
    const existing = details.find(d => d.item_id === itemId);
    const variance = qtySmall - systemBalance;

    // Reset reason if variance becomes 0
    let reason_category = existing?.reason_category;
    let reason_notes = existing?.reason_notes;
    if (variance === 0) {
      reason_category = undefined;
      reason_notes = undefined;
    }

    if (existing) {
      setDetails(details.map(d => d.item_id === itemId ? { ...d, actual_physical_qty: qtySmall, variance, reason_category, reason_notes } : d));
    } else {
      setDetails([...details, { item_id: itemId, system_balance: systemBalance, actual_physical_qty: qtySmall, variance }]);
    }
  };

  const handleReasonChange = (itemId: number, field: 'reason_category' | 'reason_notes', value: string) => {
    if (isLocked) return;
    setDetails(details.map(d => d.item_id === itemId ? { ...d, [field]: value } : d));
  };

  const handleSave = async (submit: boolean = false) => {
    // Validate reasons for non-zero variance items
    if (submit) {
      const invalidDetails = details.filter(d => d.variance !== 0 && !d.reason_category);
      if (invalidDetails.length > 0) {
        showToast('All items with a variance must have a Reason Category selected.', 'error');
        return;
      }
      const invalidOthers = details.filter(d => d.reason_category === 'LAINNYA' && !String(d.reason_notes || '').trim());
      if (invalidOthers.length > 0) {
        showToast('All items with reason "Other" must have a note filled in.', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      // Upsert all details
      for (const detail of details) {
        if (detail.actual_physical_qty !== undefined) {
          await fetch(`/api/opname/${id}/detail`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(detail)
          });
        }
      }

      if (submit) {
        // Lock the opname session
        const res = await fetch(`/api/opname/${id}/lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location_type: 'OUTLET', location_id: header.location_id })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Opname Stok berhasil dikunci. Penyesuaian telah dicatat pada Log Inventaris Outlet.', 'success');
          fetchOpname();
        } else {
          showToast(data.message || 'Failed to lock opname.', 'error');
        }
      } else {
        showToast(`Draft berhasil disimpan (${details.length} item). Stok belum berubah.`, 'success');
      }
    } catch (err: unknown) {
      showToast((err instanceof Error ? err.message : 'Unknown error'), 'error');
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
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Detail Opname Outlet — {new Date(header.count_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</h3>
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
              onChange={(val) => { setLimit(val === 'all' ? 'all' : Number(val)); setCurrentPage(1); }}
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
                  setConfirmState({
                    open: true,
                    title: 'Kunci Sesi Opname?',
                    message: 'Apakah Anda yakin ingin mengunci sesi ini? Data tidak dapat diubah setelah dikunci.',
                    onConfirm: () => {
                      setConfirmState(prev => ({ ...prev, open: false }));
                      handleSave(true);
                    }
                  });
                }} disabled={saving}>
                  Kunci & Submit
                </Button>
              </>
            )}
            <Link href="/opname/outlet">
              <Button variant="outline" size="sm">Kembali</Button>
            </Link>
          </div>
        </div>

        {!isLocked && (
          <div style={{ padding: '12px 24px', background: '#fffbeb', borderBottom: '1px solid #fde68a', color: '#b45309', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <strong>Mode Draft:</strong> Stok fisik belum berubah. Klik "Kunci & Submit" untuk menerapkan penyesuaian stok.
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Table>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: 12, minWidth: 200 }}>Nama Barang</th>
                <th className="right" style={{ padding: '12px 16px', fontSize: 12, width: 140 }}>Harga</th>
                <th className="right" style={{ padding: '12px 16px', fontSize: 12, width: 120 }}>Stok Sistem</th>
                <th className="right" style={{ width: 140, padding: '12px 16px', fontSize: 12 }}>Stok Fisik</th>
                <th className="right" style={{ width: 100, padding: '12px 16px', fontSize: 12 }}>Selisih</th>
                <th className="right" style={{ width: 130, padding: '12px 16px', fontSize: 12 }}>Est. Biaya</th>
                <th style={{ width: 180, padding: '12px 16px', fontSize: 12 }}>Alasan</th>
                <th style={{ width: 220, padding: '12px 16px', fontSize: 12 }}>Catatan</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: 12 }}>
              {paginatedItems.map((item: any) => {
                const detail = getDetail(item.item_id);
                const ratio = item.conversion_ratio || 1;
                const largeUnit = formatUnit(item.purchase_unit || item.smallest_unit);
                const smallUnit = formatUnit(item.smallest_unit);
                const priceLarge = Number(item.current_average_price) * ratio;

                const actualSmall = detail?.actual_physical_qty;
                const actualLarge = actualSmall !== undefined ? Math.round(Number(actualSmall) / Number(ratio)) : '';

                const varianceSmall = detail?.variance ?? 0;
                const varianceLarge = Math.round(Number(varianceSmall) / Number(ratio));
                const varianceValue = Math.round(Math.abs(Number(varianceSmall)) * Number(item.current_average_price));

                const sysBalLarge = Math.round(Number(item.system_balance) / Number(ratio));

                return (
                  <tr key={item.item_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="font-bold" style={{ padding: '8px 16px', fontSize: 13 }}>
                      {item.item_name}
                      <div className="muted font-normal" style={{ fontSize: 11, marginTop: 2 }}>
                        Satuan Kecil: {smallUnit} (Rasio: {ratio})
                      </div>
                    </td>
                    <td className="right num" style={{ padding: '8px 16px', fontSize: 13 }}>
                      Rp {Math.round(priceLarge).toLocaleString('id-ID')}
                      <div className="muted font-normal" style={{ fontSize: 11, marginTop: 2 }}>
                        / {largeUnit}
                      </div>
                    </td>
                    <td className="right num" style={{ padding: '8px 16px', fontSize: 13 }}>
                      {sysBalLarge.toLocaleString('id-ID')} <span className="muted" style={{ fontSize: 11 }}>{largeUnit}</span>
                    </td>
                    <td className="right" style={{ padding: '8px 16px' }}>
                      <input
                        type="number"
                        className="input right"
                        value={actualLarge}
                        onChange={(e) => handleQtyChange(item.item_id, item.system_balance, ratio, e.target.value)}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        disabled={isLocked}
                        placeholder="0"
                        step="any"
                        style={{ height: 32, width: '100%', fontSize: 13, padding: '4px 8px', borderColor: actualLarge === '' ? '#fca5a5' : 'var(--border)' }}
                      />
                    </td>
                    <td className="right num" style={{ padding: '8px 16px', fontSize: 13 }}>
                      {varianceLarge !== 0 ? (
                        <span style={{ color: varianceLarge > 0 ? 'var(--primary)' : '#dc2626', fontWeight: 600 }}>
                          {varianceLarge > 0 ? '+' : ''}{varianceLarge.toLocaleString('id-ID')}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="right num font-bold" style={{ padding: '8px 16px', fontSize: 13, color: varianceSmall !== 0 ? '#dc2626' : 'inherit' }}>
                      {varianceSmall !== 0 ? `Rp ${varianceValue.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      {varianceSmall !== 0 ? (
                        <Select
                          value={String(detail?.reason_category || '')}
                          onChange={val => handleReasonChange(item.item_id, 'reason_category', String(val))}
                          disabled={isLocked}
                          options={[
                            { value: '', label: '-- Pilih Alasan --' },
                            ...REASON_CATEGORIES
                          ]}
                          inputStyle={{ height: 32, padding: '0px 8px', fontSize: 12, borderColor: !detail?.reason_category ? '#fca5a5' : 'var(--border)' }}
                          optionStyle={{ padding: '6px 10px', fontSize: 12 }}
                        />
                      ) : (
                        <span className="muted italic" style={{ fontSize: 12 }}>Tidak ada selisih</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      {varianceSmall !== 0 && detail?.reason_category ? (
                        <input
                          type="text"
                          className="input"
                          value={String(detail?.reason_notes || '')}
                          onChange={e => handleReasonChange(item.item_id, 'reason_notes', e.target.value)}
                          disabled={isLocked}
                          placeholder={detail?.reason_category === 'LAINNYA' ? 'Wajib diisi...' : 'Opsional...'}
                          style={{ height: 32, padding: '4px 8px', fontSize: 12, width: '100%', borderColor: (detail?.reason_category === 'LAINNYA' && !String(detail?.reason_notes || '').trim()) ? '#fca5a5' : 'var(--border)' }}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <div style={{ padding: '16px' }}>
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
      </div>
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
      />
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
      />
    </section>
  );
}

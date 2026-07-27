'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { AlertOctagon, Check, X, Image as ImageIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface ReturnIssue {
  id: number;
  reported_at: string;
  delivery_note_number: string;
  outlet_name: string;
  item_name: string;
  qty_issue: number | string;
  qty_shipped: number | string;
  purchase_unit: string;
  smallest_unit?: string;
  conversion_ratio: number | string | null;
  reason: string;
  photo_url: string | null;
  dn_proof_url?: string | null;
  status: string;
  resolution_notes?: string;
}

export default function ReturnsPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<ReturnIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'PENDING' | 'RESOLVED'>('PENDING');
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; id: number | null; action: 'REPLACE' | 'WRITE_OFF' | null; notes: string }>({ isOpen: false, id: null, action: null, notes: '' });
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery-note-issues?status=${activeTab}`);
      if (!res.ok) throw new Error('Gagal mengambil data tiket retur');
      const data = await res.json();
      setIssues(data);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [activeTab]);

  const handleResolve = async () => {
    if (!confirmState.id || !confirmState.action) return;
    setResolvingId(confirmState.id);
    setConfirmState({ ...confirmState, isOpen: false });

    try {
      const res = await fetch(`/api/delivery-note-issues/${confirmState.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirmState.action, notes: confirmState.notes })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal memproses tiket');
      
      if (confirmState.action === 'REPLACE' && data.new_dn_id) {
        router.push(`/delivery-orders/${data.new_dn_id}`);
        return; // do not refresh or clear loading state, let the navigation take over
      }

      // refresh
      await fetchIssues();
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head" style={{ padding: '16px 20px', borderBottom: 'none' }}>
          <div>
            <h3 className="flex items-center gap-2 text-gray-900" style={{ fontSize: '18px', margin: 0 }}>
              <AlertOctagon className="text-red-600" size={18} />
              Tiket Masalah / Retur
            </h3>
            <p className="text-gray-500 mt-1" style={{ fontSize: '13px', margin: '4px 0 0 0' }}>Kelola laporan barang rusak/kurang dari outlet</p>
          </div>
        </div>

        <div className="tabs" style={{ marginBottom: 0, padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
          <button 
            className={`tab ${activeTab === 'PENDING' ? 'active' : ''}`} 
            onClick={() => setActiveTab('PENDING')}
            style={{ cursor: 'pointer', background: 'none', border: 'none', borderBottom: activeTab === 'PENDING' ? '2px solid var(--primary)' : '2px solid transparent', padding: '12px 16px', fontSize: 14, fontWeight: activeTab === 'PENDING' ? 600 : 500, color: activeTab === 'PENDING' ? 'var(--primary)' : 'var(--muted)' }}
          >
            Menunggu Tindakan
          </button>
          <button 
            className={`tab ${activeTab === 'RESOLVED' ? 'active' : ''}`} 
            onClick={() => setActiveTab('RESOLVED')}
            style={{ cursor: 'pointer', background: 'none', border: 'none', borderBottom: activeTab === 'RESOLVED' ? '2px solid var(--primary)' : '2px solid transparent', padding: '12px 16px', fontSize: 14, fontWeight: activeTab === 'RESOLVED' ? 600 : 500, color: activeTab === 'RESOLVED' ? 'var(--primary)' : 'var(--muted)' }}
          >
            Riwayat Selesai
          </button>
        </div>

        <div className="card-body p-0">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 m-4 rounded border border-red-200 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-6 text-center text-gray-500 text-sm">Memuat data...</div>
          ) : issues.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center">
              <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-3">
                <Check size={20} />
              </div>
              <h4 className="font-semibold text-gray-900 m-0" style={{ fontSize: '15px' }}>Semua Aman!</h4>
              <p className="text-gray-500 text-sm mt-1">
                {activeTab === 'PENDING' ? 'Tidak ada laporan barang bermasalah dari outlet saat ini.' : 'Belum ada riwayat tiket yang diselesaikan.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <th>Laporan</th>
                    <th>Ref. Surat Jalan</th>
                    <th>Barang (Dikirim)</th>
                    <th>Detail Masalah</th>
                    {activeTab === 'RESOLVED' ? <th>Resolusi</th> : null}
                    <th className="text-center">Foto Bukti</th>
                    {activeTab === 'PENDING' ? <th className="text-right">Aksi Tindakan</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {issues.map(issue => {
                    const conv = Number(issue.conversion_ratio) || 1;

                    const qtyShipped = Number(issue.qty_shipped) / conv;
                    const qtyIssue = Number(issue.qty_issue) / conv;

                    const displayPhoto = issue.photo_url || issue.dn_proof_url;

                    return (
                      <tr key={issue.id}>
                        <td>
                          <div className="font-semibold text-[13px] text-gray-900">{new Date(issue.reported_at).toLocaleDateString('id-ID')}</div>
                          <div className="text-[11px] text-gray-500 mt-1">{new Date(issue.reported_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</div>
                        </td>
                        <td>
                          <div className="font-mono text-primary font-bold text-[13px]">{issue.delivery_note_number}</div>
                          <div className="text-[11px] text-gray-600 mt-1">{issue.outlet_name}</div>
                        </td>
                        <td>
                          <div className="font-semibold text-[13px] text-gray-900">{issue.item_name}</div>
                          <div className="text-[11px] text-gray-500 mt-1">Dikirim: {qtyShipped.toLocaleString('id-ID')} {issue.purchase_unit}</div>
                        </td>
                        <td>
                          <div className="text-[13px] font-bold text-gray-900 mb-0.5">
                            {qtyIssue.toLocaleString('id-ID')} {issue.purchase_unit}
                          </div>
                          <div className="text-[11px] text-gray-600 max-w-[180px] leading-snug">
                            <span className="font-medium text-gray-500">Catatan:</span> {issue.reason}
                          </div>
                        </td>
                        {activeTab === 'RESOLVED' ? (
                          <td>
                            <div className={`font-semibold text-[13px] ${issue.status === 'APPROVED_REPLACE' ? 'text-primary' : 'text-amber-600'}`}>
                              {issue.status === 'APPROVED_REPLACE' ? 'Ganti Barang' : 'Catat Kerugian'}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-1 max-w-[180px] leading-snug">
                              {(issue as any).resolution_notes || '-'}
                            </div>
                          </td>
                        ) : null}
                        <td className="text-center">
                          {displayPhoto ? (
                            <button onClick={() => setPreviewPhoto(displayPhoto)} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded border border-gray-200 hover:bg-gray-200 transition-colors text-[11px] font-semibold">
                              <ImageIcon size={13} /> Buka Foto
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Tidak ada foto</span>
                          )}
                        </td>
                        {activeTab === 'PENDING' ? (
                          <td className="text-right whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline" size="sm"
                                onClick={() => setConfirmState({ isOpen: true, id: issue.id, action: 'WRITE_OFF', notes: '' })}
                                disabled={resolvingId === issue.id}
                                style={{ fontSize: '12px', padding: '4px 8px' }}
                              >
                                Catat Kerugian
                              </Button>
                              <Button
                                variant="primary" size="sm"
                                onClick={() => setConfirmState({ isOpen: true, id: issue.id, action: 'REPLACE', notes: '' })}
                                disabled={resolvingId === issue.id}
                                style={{ fontSize: '12px', padding: '4px 8px' }}
                              >
                                Ganti Barang
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Modal 
        isOpen={confirmState.isOpen} 
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })} 
        title={confirmState.action === 'REPLACE' ? 'Konfirmasi Penggantian Barang' : 'Konfirmasi Pencatatan Kerugian'}
      >
        <div style={{ padding: '16px 20px' }}>
          <p style={{ margin: '0 0 16px 0', color: '#475569', fontSize: 14 }}>
            {confirmState.action === 'REPLACE'
              ? 'Sistem akan otomatis membuat draft Surat Jalan baru untuk mengganti barang ini. Lanjutkan?'
              : 'Barang yang rusak ini akan dianggap sebagai penyusutan (write-off) dalam pengiriman dan tidak akan diganti. Lanjutkan?'}
          </p>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
              Catatan Tindakan (Opsional)
            </label>
            <textarea
              className="input"
              rows={3}
              placeholder="Tuliskan catatan mengapa kerugian atau penggantian ini dilakukan..."
              value={confirmState.notes}
              onChange={(e) => setConfirmState({ ...confirmState, notes: e.target.value })}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="outline" onClick={() => setConfirmState({ ...confirmState, isOpen: false })}>Batal</Button>
            <Button variant="primary" onClick={handleResolve} disabled={resolvingId === confirmState.id}>
              {resolvingId === confirmState.id ? 'Memproses...' : 'Konfirmasi'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!previewPhoto} onClose={() => setPreviewPhoto(null)} title="Foto Bukti" maxWidth={500}>
        {previewPhoto && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', height: '400px', width: '100%', backgroundColor: '#f8fafc' }}>
            <img src={previewPhoto} alt="Bukti Masalah" style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'contain' }} />
          </div>
        )}
      </Modal>
    </section>
  );
}

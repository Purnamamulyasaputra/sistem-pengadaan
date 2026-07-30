'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Toast';

interface OpnameSession {
  id: number;
  count_date: string;
  pic_name: string;
  total_value: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function CentralOpnamePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<OpnameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({ message: '', type: 'info', isOpen: false });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, isOpen: true });
  };

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/opname?location_type=PUSAT`);
    const data = await res.json();
    setSessions(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleStartOpname = async () => {
    setCreating(true);
    try {
      const payload = {
        location_type: 'PUSAT',
        count_date: new Date().toISOString().split('T')[0],
        general_notes: 'Central Warehouse Stock Opname'
      };

      const res = await fetch('/api/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        router.push(`/opname/central/${data.data.id}`);
      } else {
        showToast(data.message || 'Failed to start opname', 'error');
        setCreating(false);
      }
    } catch (err: unknown) {
      showToast((err instanceof Error ? err.message : 'Unknown error'), 'error');
      setCreating(false);
    }
  };

  const filteredSessions = filterDate ? sessions.filter(s => s.count_date.startsWith(filterDate)) : sessions;

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Stock Opname Pusat</h3>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="input"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              style={{ fontSize: 13, height: 34, minWidth: 140 }}
            />
            <Button variant="primary" style={{ height: 34, padding: '0 16px', fontSize: 13, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }} onClick={handleStartOpname} disabled={creating}>
              {creating ? 'Memulai...' : '+ Mulai Opname'}
            </Button>
          </div>
        </div>

        <div className="card-body flush" style={{ overflowY: 'auto' }}>
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat riwayat opname...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <h4>Belum ada riwayat opname</h4>
              <p>Anda belum pernah melakukan opname stok pusat.</p>
              <Button variant="primary" size="sm" onClick={handleStartOpname} style={{ marginTop: 12 }}>Mulai Opname Pertama</Button>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Tanggal Opname</th>
                  <th>Waktu Mulai</th>
                  <th>Terakhir Diubah</th>
                  <th>Dilakukan Oleh</th>
                  <th className="right">Est. Selisih Nilai</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: 13 }}>
                {filteredSessions.map(s => (
                  <tr key={s.id} onClick={() => router.push(`/opname/central/${s.id}`)} className="hover-row" style={{ cursor: 'pointer' }}>
                    <td className="font-bold">{new Date(s.count_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                    <td className="muted">
                      {new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="muted">
                      {new Date(s.updated_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="muted">{s.pic_name}</td>
                    <td className="right font-mono font-bold" style={{ color: Number(s.total_value) > 0 ? '#016e3f' : Number(s.total_value) < 0 ? '#dc2626' : 'var(--muted)' }}>
                      {Number(s.total_value) > 0 ? '+Rp ' : Number(s.total_value) < 0 ? '-Rp ' : 'Rp '}{Math.abs(Number(s.total_value)).toLocaleString('id-ID')}
                    </td>
                    <td className="center">
                      <Badge variant={s.status === 'LOCKED' ? 'green' : s.status === 'SUBMITTED' ? 'blue' : 'gray'}>
                        {s.status === 'LOCKED' ? 'Selesai' : s.status === 'SUBMITTED' ? 'Diajukan' : s.status === 'DRAFT' ? 'Draf' : s.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
      />
    </section>
  );
}

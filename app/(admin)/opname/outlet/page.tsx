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

export default function OutletOpnamePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<OpnameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({ message: '', type: 'info', isOpen: false });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, isOpen: true });
  };

  const fetchSessions = useCallback(async (outletId: number) => {
    const res = await fetch(`/api/opname?location_type=OUTLET&location_id=${outletId}`);
    const data = await res.json();
    setSessions(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.data) {
        setUser(data.data);
        if (data.data.outlet_id) {
          await fetchSessions(data.data.outlet_id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    init();
  }, [fetchSessions]);

  const handleStartOpname = async () => {
    if (!user?.outlet_id) {
      showToast("Outlet ID not found", 'error');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        location_type: 'OUTLET',
        location_id: user.outlet_id,
        count_date: new Date().toISOString().split('T')[0],
        general_notes: 'Outlet Stock Opname'
      };
      
      const res = await fetch('/api/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        router.push(`/opname/outlet/${data.data.id}`);
      } else {
        showToast(data.message || 'Failed to start opname', 'error');
        setCreating(false);
      }
    } catch (err: unknown) {
      showToast((err instanceof Error ? err.message : 'Unknown error'), 'error');
      setCreating(false);
    }
  };

  return (
    <section className="screen">
      <div className="card">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <a href="/opname/outlet" className="tab active" style={{ textDecoration: 'none' }}>Stock Opname</a>
          <a href="/outlet/items" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Item Reference</a>
        </div>
        <div className="card-head" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Outlet Stock Opname & Usage</h3>
          </div>
          <Button variant="primary" size="sm" onClick={handleStartOpname} disabled={creating || !user?.outlet_id}>
            {creating ? 'Memulai...' : '+ Start Daily Report'}
          </Button>
        </div>
        <div className="card-body flush" style={{ overflowY: 'auto' }}>
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat riwayat opname...</div>
          ) : !user?.outlet_id ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Anda tidak terkait dengan outlet manapun.</div>
          ) : sessions.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <h4>Belum ada riwayat opname</h4>
              <p>Anda belum pernah melakukan opname stok outlet.</p>
              <Button variant="primary" size="sm" onClick={handleStartOpname} style={{ marginTop: 12 }}>Mulai Opname Pertama</Button>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', fontSize: 11 }}>Tanggal Opname</th>
                  <th style={{ padding: '12px 16px', fontSize: 11 }}>Waktu Mulai</th>
                  <th style={{ padding: '12px 16px', fontSize: 11 }}>Terakhir Diubah</th>
                  <th style={{ padding: '12px 16px', fontSize: 11 }}>Dilakukan Oleh</th>
                  <th className="right" style={{ padding: '12px 16px', fontSize: 11 }}>Est. Biaya Pemakaian</th>
                  <th className="center" style={{ padding: '12px 16px', fontSize: 11 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} onClick={() => router.push(`/opname/outlet/${s.id}`)} className="hover-row" style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                    <td className="font-bold" style={{ padding: '12px 16px', fontSize: 12 }}>{new Date(s.count_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                    <td className="muted" style={{ padding: '12px 16px', fontSize: 12 }}>
                      {new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="muted" style={{ padding: '12px 16px', fontSize: 12 }}>
                      {new Date(s.updated_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="muted" style={{ padding: '12px 16px', fontSize: 12 }}>{s.pic_name}</td>
                    <td className="right font-mono font-bold" style={{ padding: '12px 16px', fontSize: 12, color: Number(s.total_value) > 0 ? '#dc2626' : 'var(--muted)' }}>
                      Rp {Number(s.total_value).toLocaleString('id-ID')}
                    </td>
                    <td className="center" style={{ padding: '12px 16px' }}>
                      <Badge variant={s.status === 'LOCKED' ? 'green' : s.status === 'SUBMITTED' ? 'blue' : 'gray'}>
                        {s.status}
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

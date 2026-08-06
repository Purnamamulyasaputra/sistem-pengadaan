'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Toast';
import { Pagination } from '@/components/ui/Pagination';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState<number | 'all'>(15);
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
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700, whiteSpace: 'nowrap' }}>Stock Opname Pusat</h3>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
            <input
              type="date"
              className="input"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              style={{ fontSize: 13, height: 28, minWidth: 120, width: 'auto' }}
            />
            <Button variant="primary" style={{ height: 28, padding: '0 12px', fontSize: 12, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }} onClick={handleStartOpname} disabled={creating}>
              {creating ? 'Memulai...' : '+ Mulai Opname'}
            </Button>
          </div>
        </div>

        <div className="card-body flush" style={{ overflowY: 'auto', background: '#f8fafc' }}>
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat riwayat opname...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <h4>Belum ada riwayat opname</h4>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Anda belum pernah melakukan opname stok pusat.</p>
            </div>
          ) : (
            <div style={{ padding: '24px 20px 20px' }}>
              {(() => {
                const displayedSessions = limit === 'all' ? filteredSessions : filteredSessions.slice((currentPage - 1) * limit, currentPage * limit);
                const groupedSessions = displayedSessions.reduce((acc, session) => {
                  const dateStr = session.count_date.split('T')[0];
                  if (!acc[dateStr]) acc[dateStr] = [];
                  acc[dateStr].push(session);
                  return acc;
                }, {} as Record<string, OpnameSession[]>);

                const sortedDates = Object.keys(groupedSessions).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

                return sortedDates.map(date => (
                  <div key={date} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ background: '#016e3f', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, boxShadow: '0 2px 4px rgba(1, 110, 63, 0.2)' }}>
                        {new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <div style={{ flex: 1, height: 1, background: '#e2e8f0', marginLeft: 16 }}></div>
                    </div>
                    <div style={{ display: 'grid', gap: 8, paddingLeft: 8 }}>
                      {groupedSessions[date].map(s => (
                        <div 
                          key={s.id} 
                          onClick={() => router.push(`/opname/central/${s.id}`)}
                          style={{ 
                            display: 'flex', alignItems: 'center', padding: '8px 12px', 
                            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, 
                            cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            position: 'relative'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
                            e.currentTarget.style.transform = 'none';
                          }}
                        >
                          <div style={{ width: 4, height: '70%', background: s.status === 'LOCKED' ? '#016e3f' : s.status === 'SUBMITTED' ? '#3b82f6' : '#cbd5e1', position: 'absolute', left: 0, top: '15%', borderRadius: '0 4px 4px 0' }}></div>
                          <div style={{ width: 130, paddingLeft: 12 }}>
                            <div className="muted" style={{ fontSize: 10, marginBottom: 2 }}>Waktu Mulai</div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                          
                          <div style={{ width: 180 }}>
                            <div className="muted" style={{ fontSize: 10, marginBottom: 2 }}>Dilakukan Oleh</div>
                            <div style={{ fontWeight: 600, fontSize: 12, color: '#334155' }}>{s.pic_name}</div>
                          </div>
              
                          <div style={{ flex: 1, textAlign: 'right', paddingRight: 32 }}>
                            <div className="muted" style={{ fontSize: 10, marginBottom: 2 }}>Estimasi Selisih Nilai</div>
                            <div className="font-mono font-bold" style={{ fontSize: 13, color: Number(s.total_value) > 0 ? '#016e3f' : Number(s.total_value) < 0 ? '#dc2626' : '#94a3b8' }}>
                              {Number(s.total_value) > 0 ? '+Rp ' : Number(s.total_value) < 0 ? '-Rp ' : 'Rp '}{Math.abs(Number(s.total_value)).toLocaleString('id-ID')}
                            </div>
                          </div>
              
                          <div style={{ width: 140, textAlign: 'right' }}>
                            <Badge variant={s.status === 'LOCKED' ? 'green' : s.status === 'SUBMITTED' ? 'blue' : 'gray'}>
                              {s.status === 'LOCKED' ? 'Selesai' : s.status === 'SUBMITTED' ? 'Diajukan' : s.status === 'DRAFT' ? 'Draf' : s.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
          
          {limit !== 'all' && filteredSessions.length > (limit as number) && (
            <div style={{ padding: '0 20px 20px' }}>
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredSessions.length / (limit as number))}
                totalItems={filteredSessions.length}
                itemsPerPage={limit as number}
                onPageChange={setCurrentPage}
              />
            </div>
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

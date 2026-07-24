'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

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

  // Hardcoded for Phase 1 demo
  const PIC_ID = 1; // Assuming Central Admin ID is 1

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
        pic_id: PIC_ID,
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
        alert(data.message || 'Failed to start opname');
        setCreating(false);
      }
    } catch (err: any) {
      alert(err.message);
      setCreating(false);
    }
  };

  return (
    <section style={{ margin: '-16px -20px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Stock Opname Pusat</h3>
          </div>
          <Button variant="primary" size="sm" onClick={handleStartOpname} disabled={creating}>
            {creating ? 'Memulai...' : '+ Mulai Opname'}
          </Button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat riwayat opname...</div>
          ) : sessions.length === 0 ? (
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
                  <th style={{ padding: '12px 24px', fontSize: 12 }}>Tanggal Opname</th>
                  <th style={{ padding: '12px 24px', fontSize: 12 }}>Waktu Mulai</th>
                  <th style={{ padding: '12px 24px', fontSize: 12 }}>Terakhir Diubah</th>
                  <th style={{ padding: '12px 24px', fontSize: 12 }}>Dilakukan Oleh</th>
                  <th className="right" style={{ padding: '12px 24px', fontSize: 12 }}>Est. Biaya Pemakaian</th>
                  <th className="center" style={{ padding: '12px 24px', fontSize: 12 }}>Status</th>
                  <th className="right" style={{ padding: '12px 24px', fontSize: 12 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="font-bold" style={{ padding: '12px 24px', fontSize: 13 }}>{new Date(s.count_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                    <td className="muted" style={{ padding: '12px 24px', fontSize: 13 }}>
                      {new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="muted" style={{ padding: '12px 24px', fontSize: 13 }}>
                      {new Date(s.updated_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="muted" style={{ padding: '12px 24px', fontSize: 13 }}>{s.pic_name}</td>
                    <td className="right font-mono font-bold" style={{ padding: '12px 24px', fontSize: 13, color: Number(s.total_value) > 0 ? '#dc2626' : 'var(--muted)' }}>
                      Rp {Number(s.total_value).toLocaleString('id-ID')}
                    </td>
                    <td className="center" style={{ padding: '12px 24px' }}>
                      <Badge variant={s.status === 'LOCKED' ? 'green' : s.status === 'SUBMITTED' ? 'blue' : 'gray'}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="right" style={{ padding: '12px 24px' }}>
                      <Link href={`/opname/central/${s.id}`}>
                        <Button size="sm" style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>
                          {s.status === 'DRAFT' ? 'Lanjutkan' : 'Lihat Detail'}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </section>
  );
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';

interface OpnameSession {
  id: number;
  count_date: string;
  pic_name: string;
  total_value: number;
  status: string;
}

export default function OutletOpnamePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<OpnameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [outletId, setOutletId] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchSessions = useCallback(async (oId: number) => {
    setLoading(true);
    const res = await fetch(`/api/opname?location_type=OUTLET&location_id=${oId}`);
    const data = await res.json();
    setSessions(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Get outletId from session via API
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.outlet_id) {
          setOutletId(d.data.outlet_id);
          fetchSessions(d.data.outlet_id);
        }
      });
  }, [fetchSessions]);

  const handleStartOpname = async () => {
    if (!outletId) return;
    setCreating(true);
    try {
      const payload = {
        location_type: 'OUTLET',
        location_id: outletId,
        count_date: new Date().toISOString().split('T')[0],
        general_notes: 'Weekly Stock Opname'
      };

      const res = await fetch('/api/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        router.push(`/outlet/opname/${data.data.id}`);
      } else {
        alert(data.message || 'Gagal memulai opname');
        setCreating(false);
      }
    } catch (err: any) {
      alert(err.message);
      setCreating(false);
    }
  };

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Stock Opname Outlet</h3>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select className="input" style={{ width: 90 }} value={limit} onChange={(e) => { setLimit(e.target.value === 'all' ? 'all' : Number(e.target.value)); setCurrentPage(1); }}>
              <option value="all">Semua</option>
              <option value="8">8</option>
              <option value="32">32</option>
            </select>
            <Button variant="primary" size="sm" onClick={handleStartOpname} disabled={creating}>
              {creating ? 'Memulai...' : '+ Mulai Sesi Opname'}
            </Button>
          </div>
        </div>

        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Memuat riwayat opname...</div>
          ) : sessions.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <h4>Belum ada riwayat opname</h4>
              <p>Anda belum pernah melakukan stock opname.</p>
              <Button variant="primary" size="sm" onClick={handleStartOpname} style={{ marginTop: 12 }}>Mulai Opname Pertama</Button>
            </div>
          ) : (
            <>
            <Table>
              <thead>
                <tr>
                  <th>Tanggal Opname</th>
                  <th>Dilakukan Oleh</th>
                  <th className="right">Est. Biaya Pemakaian</th>
                  <th className="center">Status</th>
                  <th className="right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(limit === 'all' ? sessions : sessions.slice((currentPage - 1) * limit, currentPage * limit)).map(s => (
                  <tr key={s.id}>
                    <td className="font-bold">{new Date(s.count_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                    <td className="muted">{s.pic_name}</td>
                    <td className="right font-mono">Rp {Number(s.total_value).toLocaleString('id-ID')}</td>
                    <td className="center">
                      <Badge variant={s.status === 'LOCKED' ? 'green' : s.status === 'SUBMITTED' ? 'blue' : 'gray'}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="right">
                      <Link href={`/outlet/opname/${s.id}`}>
                        <Button size="sm" style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>
                          {s.status === 'DRAFT' ? 'Lanjutkan' : 'Lihat Detail'}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            
            {limit !== 'all' && sessions.length > (limit as number) && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(sessions.length / limit)}
                totalItems={sessions.length}
                itemsPerPage={limit as number}
                onPageChange={setCurrentPage}
              />
            )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

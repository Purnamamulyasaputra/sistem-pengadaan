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
    <section className="screen">
      <div className="card">

        <div className="card-head">
          <div>
            <h3>Central Stock Opname</h3>
          </div>
          <Button variant="primary" size="sm" onClick={handleStartOpname} disabled={creating}>
            {creating ? 'Starting...' : '+ Start Opname Session'}
          </Button>
        </div>
        
        <div className="card-body flush">
          {loading ? (
            <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading opname history...</div>
          ) : sessions.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <h4>No opname history</h4>
              <p>You haven't conducted any central stock opname yet.</p>
              <Button variant="primary" size="sm" onClick={handleStartOpname} style={{ marginTop: 12 }}>Start First Opname</Button>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Opname Date</th>
                  <th>Conducted By</th>
                  <th className="right">Total Adjustment Value</th>
                  <th className="center">Status</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td className="font-bold">{new Date(s.count_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                    <td className="muted">{s.pic_name}</td>
                    <td className="right font-mono font-bold" style={{ color: Number(s.total_value) > 0 ? '#dc2626' : 'var(--muted)' }}>
                      Rp {Number(s.total_value).toLocaleString('id-ID')}
                    </td>
                    <td className="center">
                      <Badge variant={s.status === 'LOCKED' ? 'green' : s.status === 'SUBMITTED' ? 'blue' : 'gray'}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="right">
                      <Link href={`/opname/central/${s.id}`}>
                        <Button size="sm" style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid #bcdcf3' }}>
                          {s.status === 'DRAFT' ? 'Continue' : 'View Detail'}
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

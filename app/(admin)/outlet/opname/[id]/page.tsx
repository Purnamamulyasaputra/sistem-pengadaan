'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

export default function OutletOpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [header, setHeader] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [details, setDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const fetchOpname = useCallback(async () => {
    setLoading(true);
    // Fetch header
    const hRes = await fetch(`/api/opname/${id}`);
    if (hRes.ok) {
      const hData = await hRes.json();
      setHeader(hData.data);
      setIsLocked(hData.data?.status === 'LOCKED');
    }
    
    // Fetch all items for input
    const iRes = await fetch(`/api/opname/items?location_type=OUTLET`);
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
    const qty = parseFloat(actualQty);
    if (isNaN(qty)) return;

    const existing = details.find(d => d.item_id === itemId);
    if (existing) {
      setDetails(details.map(d => d.item_id === itemId ? { ...d, actual_physical_qty: qty, variance: qty - systemBalance } : d));
    } else {
      setDetails([...details, { item_id: itemId, system_balance: systemBalance, actual_physical_qty: qty, variance: qty - systemBalance }]);
    }
  };

  const handleSave = async (submit: boolean = false) => {
    setSaving(true);
    try {
      // Upsert all details
      for (const detail of details) {
        await fetch(`/api/opname/${id}/detail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(detail)
        });
      }

      if (submit) {
        // Lock the opname session
        const res = await fetch(`/api/opname/${id}/lock`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alert('Stock Opname successfully locked.');
          fetchOpname();
        } else {
          alert(data.message || 'Failed to lock opname.');
        }
      } else {
        alert('Draft saved successfully.');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading opname data...</div>;
  if (!header) return <div style={{ padding: 40, textAlign: 'center' }}>Session not found.</div>;

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Opname Detail — {new Date(header.count_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</h3>
            <div style={{ marginTop: 8 }}>
              <Badge variant={isLocked ? 'green' : header.status === 'SUBMITTED' ? 'blue' : 'gray'}>{header.status}</Badge>
            </div>
          </div>
          <Link href="/outlet/opname">
            <Button variant="outline" size="sm">Back to List</Button>
          </Link>
        </div>
        
        <div className="card-body flush">
          <Table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th className="right">System Balance</th>
                <th className="right" style={{ width: 140 }}>Physical Qty</th>
                <th className="right">Variance</th>
                <th className="right">Usage Cost Est.</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const detail = getDetail(item.item_id);
                const actual = detail ? detail.actual_physical_qty : '';
                const variance = detail ? detail.variance : 0;
                // Cost calculation: absolute variance * current average price
                const cost = Math.abs(variance) * Number(item.current_average_price);
                
                return (
                  <tr key={item.item_id}>
                    <td className="font-bold">{item.item_name}</td>
                    <td className="muted">{item.category_name}</td>
                    <td className="right num">{Number(item.system_balance).toFixed(2)} {item.smallest_unit}</td>
                    <td className="right">
                      <input 
                        type="number" 
                        className="input right" 
                        value={actual} 
                        onChange={(e) => handleQtyChange(item.item_id, item.system_balance, e.target.value)} 
                        disabled={isLocked}
                        placeholder="0.00"
                        step="0.01"
                        style={{ height: 32, width: '100%', borderColor: actual === '' ? '#fca5a5' : 'var(--border)' }} 
                      />
                    </td>
                    <td className="right num">
                      {variance !== 0 ? (
                        <span style={{ color: variance > 0 ? 'var(--primary)' : '#dc2626', fontWeight: 600 }}>
                          {variance > 0 ? '+' : ''}{variance.toFixed(2)}
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
          
          {!isLocked && (
            <div style={{ padding: 24, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Items without input will be considered having 0 variance.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>Save Draft</Button>
                <Button variant="primary" onClick={() => {
                  if (confirm('Are you sure you want to lock this session? Data cannot be changed after locking.')) {
                    handleSave(true);
                  }
                }} disabled={saving}>
                  Lock & Submit
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

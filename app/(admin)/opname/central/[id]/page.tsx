'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const REASON_CATEGORIES = [
  { value: 'RUSAK', label: 'Damaged (Rusak)' },
  { value: 'KADALUARSA', label: 'Expired (Kadaluarsa)' },
  { value: 'SALAH_CATAT', label: 'Misrecorded (Salah Catat)' },
  { value: 'HILANG_SUSUT', label: 'Lost/Shrinkage (Hilang/Susut)' },
  { value: 'LAINNYA', label: 'Other (Lainnya)' },
];

export default function CentralOpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
    const iRes = await fetch(`/api/opname/items?location_type=PUSAT`);
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
    const variance = qty - systemBalance;
    
    // Reset reason if variance becomes 0
    let reason_category = existing?.reason_category;
    let reason_notes = existing?.reason_notes;
    if (variance === 0) {
      reason_category = undefined;
      reason_notes = undefined;
    }

    if (existing) {
      setDetails(details.map(d => d.item_id === itemId ? { ...d, actual_physical_qty: qty, variance, reason_category, reason_notes } : d));
    } else {
      setDetails([...details, { item_id: itemId, system_balance: systemBalance, actual_physical_qty: qty, variance }]);
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
        alert('All items with a variance must have a Reason Category selected.');
        return;
      }
      const invalidOthers = details.filter(d => d.reason_category === 'LAINNYA' && !d.reason_notes?.trim());
      if (invalidOthers.length > 0) {
        alert('All items with reason "Other" must have a note filled in.');
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
          body: JSON.stringify({ location_type: 'PUSAT' })
        });
        const data = await res.json();
        if (data.success) {
          alert('Stock Opname successfully locked. Adjustments have been posted to Inventory Logs.');
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
            <h3>Central Opname Detail — {new Date(header.count_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</h3>
            <div style={{ marginTop: 8 }}>
              <Badge variant={isLocked ? 'green' : header.status === 'SUBMITTED' ? 'blue' : 'gray'}>{header.status}</Badge>
            </div>
          </div>
          <Link href="/opname/central">
            <Button variant="outline" size="sm">Back to List</Button>
          </Link>
        </div>
        
        <div className="card-body flush">
          <Table>
            <thead>
              <tr>
                <th style={{ padding: '4px 8px', fontSize: 11 }}>Item Name</th>
                <th className="right" style={{ padding: '4px 8px', fontSize: 11 }}>System Bal</th>
                <th className="right" style={{ width: 100, padding: '4px 8px', fontSize: 11 }}>Phys Qty</th>
                <th className="right" style={{ width: 70, padding: '4px 8px', fontSize: 11 }}>Var.</th>
                <th style={{ width: 180, padding: '4px 8px', fontSize: 11 }}>Reason Category</th>
                <th style={{ width: 220, padding: '4px 8px', fontSize: 11 }}>Notes</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: 12 }}>
              {items.map(item => {
                const detail = getDetail(item.item_id);
                const actual = detail?.actual_physical_qty ?? '';
                const variance = detail?.variance ?? 0;
                
                return (
                  <tr key={item.item_id}>
                    <td className="font-bold" style={{ padding: '2px 8px' }}>
                      {item.item_name}
                      <div className="muted font-normal" style={{ fontSize: 10, marginTop: 1 }}>
                        MA Price: Rp {Number(item.current_average_price).toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td className="right num" style={{ padding: '2px 8px' }}>{Number(item.system_balance).toLocaleString('id-ID')} <span className="muted" style={{ fontSize: 10 }}>{item.smallest_unit}</span></td>
                    <td className="right" style={{ padding: '2px 8px' }}>
                      <input 
                        type="number" 
                        className="input right" 
                        value={actual} 
                        onChange={(e) => handleQtyChange(item.item_id, item.system_balance, e.target.value)} 
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        disabled={isLocked}
                        placeholder="0"
                        step="any"
                        style={{ height: 24, width: '100%', fontSize: 12, padding: '2px 6px', borderColor: actual === '' ? '#fca5a5' : 'var(--border)' }} 
                      />
                    </td>
                    <td className="right num" style={{ padding: '2px 8px' }}>
                      {variance !== 0 ? (
                        <span style={{ color: variance > 0 ? 'var(--primary)' : '#dc2626', fontWeight: 600 }}>
                          {variance > 0 ? '+' : ''}{Number(variance).toLocaleString('id-ID')}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '2px 8px' }}>
                      {variance !== 0 ? (
                        <select 
                          className="input" 
                          value={detail?.reason_category || ''} 
                          onChange={e => handleReasonChange(item.item_id, 'reason_category', e.target.value)}
                          disabled={isLocked}
                          style={{ height: 24, padding: '0px 6px', fontSize: 11, borderColor: !detail?.reason_category ? '#fca5a5' : 'var(--border)' }}
                        >
                          <option value="">-- Select Reason --</option>
                          {REASON_CATEGORIES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      ) : (
                        <span className="muted italic" style={{ fontSize: 11 }}>No variance</span>
                      )}
                    </td>
                    <td style={{ padding: '2px 8px' }}>
                      {variance !== 0 && detail?.reason_category ? (
                        <input 
                          type="text" 
                          className="input" 
                          value={detail?.reason_notes || ''} 
                          onChange={e => handleReasonChange(item.item_id, 'reason_notes', e.target.value)}
                          disabled={isLocked}
                          placeholder={detail?.reason_category === 'LAINNYA' ? 'Required notes...' : 'Optional notes...'}
                          style={{ height: 24, padding: '2px 6px', fontSize: 11, width: '100%', borderColor: (detail?.reason_category === 'LAINNYA' && !detail?.reason_notes?.trim()) ? '#fca5a5' : 'var(--border)' }}
                        />
                      ) : null}
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
                  if (confirm('Are you sure you want to lock this session? All discrepancies will be posted as ADJ to inventory.')) {
                    handleSave(true);
                  }
                }} disabled={saving}>
                  Lock & Adjust Inventory
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

'use client';
import { useState, useEffect, useCallback } from 'react';

interface PO {
  id: number; po_number: string; vendor_name: string; order_date: string;
  order_deadline?: string; status: string; total: number; buyer_name: string;
  created_at: string;
}

interface Vendor { id: number; name: string; is_active?: boolean; }
interface Item { id: number; name: string; purchase_unit: string; conversion_ratio: number; current_average_price: number; }
interface Outlet { id: number; name: string; is_active?: boolean; }

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  RFQ: { label: 'RFQ', bg: '#f1f5f9', text: '#475569' },
  RFQ_TERKIRIM: { label: 'RFQ Sent', bg: '#dbeafe', text: '#1d4ed8' },
  PURCHASE_ORDER: { label: 'Purchase Order', bg: '#e0e7ff', text: '#4338ca' },
  DITERIMA_SEBAGIAN: { label: 'Partially Received', bg: '#fefce8', text: '#a16207' },
  SELESAI: { label: 'Completed', bg: '#dcfce7', text: '#15803d' },
  DIBATALKAN: { label: 'Cancelled', bg: '#fee2e2', text: '#b91c1c' },
};

const fmtCurrency = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const STATUSES = ['RFQ', 'RFQ_TERKIRIM', 'PURCHASE_ORDER', 'DITERIMA_SEBAGIAN', 'SELESAI', 'DIBATALKAN'];

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PO[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ vendor_id: '', vendor_reference: '', deliver_to: 'Gudang Cihapit', destination_outlet_id: '', order_date: new Date().toISOString().split('T')[0], order_deadline: '', payment_terms: '', internal_notes: '' });
  const [lines, setLines] = useState([{ type: 'product', item_id: '', description: '', qty: '', unit_price: '', tax_percent: '11', disc_percent: '0' }]);
  const [draftPO, setDraftPO] = useState<PO | null>(null);
  const [activeTab, setActiveTab] = useState('Ingredients');
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [deliverToFocused, setDeliverToFocused] = useState(false);

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    const params = statusFilter ? `?status=${statusFilter}` : '';
    const res = await fetch(`/api/purchase-orders${params}`);
    const data = await res.json();
    setPos(data.data ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchPOs();
    fetch('/api/vendors').then(r => r.json()).then(d => setVendors((d.data ?? []).filter((v: Vendor) => v.is_active !== false)));
    fetch('/api/items?active_only=true').then(r => r.json()).then(d => setItems(d.data ?? []));
    fetch('/api/outlets').then(r => r.json()).then(d => {
      const activeOutlets = (d.data ?? []).filter((o: Outlet) => o.is_active !== false);
      setOutlets(activeOutlets);
    });
  }, [fetchPOs]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const openId = urlParams.get('open');
      if (openId) {
        handleViewPO({ id: Number(openId) } as any);
        window.history.replaceState({}, '', '/purchase-orders');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLine() {
    setLines(l => [...l, { type: 'product', item_id: '', description: '', qty: '', unit_price: '', tax_percent: '11', disc_percent: '0' }]);
  }

  function addNote() {
    setLines(l => [...l, { type: 'note', item_id: '', description: '', qty: '', unit_price: '', tax_percent: '0', disc_percent: '0' }]);
  }

  function removeLine(i: number) {
    setLines(l => l.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: string, value: string) {
    setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line));
  }

  function handleItemTextChange(lineIdx: number, text: string) {
    const item = items.find(i => i.name === text);
    if (item) {
      setLines(l => l.map((line, idx) => idx === lineIdx ? { ...line, item_id: String(item.id), description: text, unit_price: String(Math.round(item.current_average_price * (item.conversion_ratio || 1))) } : line));
    } else {
      setLines(l => l.map((line, idx) => idx === lineIdx ? { ...line, item_id: '', description: text } : line));
    }
  }

  let computedSubtotal = 0;
  let computedTax = 0;
  lines.forEach(l => {
    if (l.type === 'product') {
      const q = Number(l.qty) || 0;
      const up = Number(l.unit_price) || 0;
      const t = Number(l.tax_percent) || 0;
      const d = Number(l.disc_percent) || 0;
      const net = (q * up) * (1 - d / 100);
      computedSubtotal += net;
      computedTax += net * (t / 100);
    }
  });
  const computedTotal = computedSubtotal + computedTax;

  async function handleSave(statusToSet?: string) {
    if (!form.vendor_id) { setError('Kolom Vendor tidak boleh kosong.'); return; }
    if (!form.deliver_to.trim()) { setError('Kolom Deliver To tidak boleh kosong.'); return; }
    if (!form.order_deadline) { setError('Kolom Order Deadline tidak boleh kosong.'); return; }
    
    const validLines = lines.filter(l => (l.type === 'product' ? (l.item_id && l.qty && l.unit_price) : l.description));
    if (!validLines.length) { setError('Minimal 1 item/bahan harus diisi dengan lengkap.'); return; }
    
    setSaving(true); setError('');
    try {
      const url = draftPO ? `/api/purchase-orders/${draftPO.id}` : '/api/purchase-orders';
      const method = draftPO ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          vendor_id: Number(form.vendor_id),
          items: validLines.map((l, idx) => ({
            line_type: l.type === 'note' ? 'CATATAN' : 'PRODUK',
            item_id: l.type === 'product' ? Number(l.item_id) : null,
            description: l.description,
            qty: l.type === 'product' ? Number(l.qty) : 0,
            unit_price: l.type === 'product' ? Number(l.unit_price) : 0,
            tax_percent: l.type === 'product' ? Number(l.tax_percent) : 0,
            discount_percent: l.type === 'product' ? Number(l.disc_percent) : 0,
            sort_order: idx,
          })),
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }
      
      let finalPO = data.data;
      
      if (statusToSet) {
        await fetch(`/api/purchase-orders/${finalPO.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: statusToSet }),
        });
        const res2 = await fetch(`/api/purchase-orders/${finalPO.id}`);
        const data2 = await res2.json();
        finalPO = data2.data;
      }
      
      setDraftPO(finalPO);
      fetchPOs();
    } finally { setSaving(false); }
  }

  async function handleViewPO(po: PO) {
    const res = await fetch(`/api/purchase-orders/${po.id}`);
    const data = await res.json();
    const fetchedPO = data.data;
    
    setDraftPO(fetchedPO);
    setForm({
      vendor_id: String(fetchedPO.vendor_id || ''),
      vendor_reference: fetchedPO.vendor_reference || '',
      deliver_to: fetchedPO.deliver_to || '',
      destination_outlet_id: fetchedPO.destination_outlet_id ? String(fetchedPO.destination_outlet_id) : '',
      order_date: fetchedPO.order_date ? fetchedPO.order_date.split('T')[0] : '',
      order_deadline: fetchedPO.order_deadline ? fetchedPO.order_deadline.split('T')[0] : '',
      payment_terms: fetchedPO.payment_terms || '',
      internal_notes: fetchedPO.internal_notes || ''
    } as any);
    
    const fetchedLines = (fetchedPO.items || []).map((i: any) => ({
      type: i.line_type === 'CATATAN' ? 'note' : 'product',
      item_id: i.item_id ? String(i.item_id) : '',
      description: i.description || '',
      qty: String(i.qty || ''),
      unit_price: String(i.unit_price || ''),
      tax_percent: String(i.tax_percent || '0'),
      disc_percent: String(i.discount_percent || '0')
    }));
    
    setLines(fetchedLines.length ? fetchedLines : [{ type: 'product', item_id: '', description: '', qty: '', unit_price: '', tax_percent: '11', disc_percent: '0' }]);
    setShowModal(true);
  }

  async function handleUpdateStatus(poId: number, status: string) {
    await fetch(`/api/purchase-orders/${poId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const res = await fetch(`/api/purchase-orders/${poId}`);
    const data = await res.json();
    setDraftPO(data.data);
    fetchPOs();
  }

  // Calculate KPIs
  const toSend = pos.filter(p => p.status === 'RFQ').length;
  const waiting = pos.filter(p => p.status === 'RFQ_TERKIRIM' || p.status === 'PURCHASE_ORDER').length;
  const late = pos.filter(p => p.order_deadline && new Date(p.order_deadline) < new Date() && !['SELESAI', 'DIBATALKAN'].includes(p.status)).length;

  const avgOrderValue = pos.length ? pos.reduce((s, p) => s + Number(p.total), 0) / pos.length : 0;
  const purchased7Days = pos.filter(p => new Date(p.created_at) > new Date(Date.now() - 7 * 86400000)).reduce((s, p) => s + Number(p.total), 0);
  const rfqSent7Days = pos.filter(p => p.status === 'RFQ_TERKIRIM' && new Date(p.created_at) > new Date(Date.now() - 7 * 86400000)).length;

  return (
    <section className="screen">
      {!showModal ? (
        <div className="card">
          <div className="tabs" style={{ marginBottom: 0 }}>
            <a href="/purchase-orders" className="tab active" style={{ textDecoration: 'none' }}>Purchase Orders</a>
            <a href="/goods-receipt" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Goods Receipt</a>
          </div>
          <div className="card-head" style={{ paddingBottom: 10 }}>
            <div>
              <h3 style={{ fontSize: 18, margin: 0 }}>Requests for Quotation</h3>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { 
              setError(''); 
              setDraftPO(null);
              setForm({ vendor_id: '', vendor_reference: '', deliver_to: '', destination_outlet_id: '', order_date: new Date().toISOString().split('T')[0], order_deadline: '', payment_terms: '', internal_notes: '' });
              setLines([{ type: 'product', item_id: '', description: '', qty: '', unit_price: '', tax_percent: '11', disc_percent: '0' }]);
              setShowModal(true); 
            }}>Create PO</button>
          </div>

          {/* Odoo KPI Dashboard */}
          <div style={{ padding: '10px 16px', display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', background: '#fff', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Left KPI Cards */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 85, height: 50, background: 'var(--primary)', color: 'white', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(1, 110, 63, 0.2)' }} onClick={() => setStatusFilter('RFQ')}>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{toSend}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>To Send</div>
              </div>
              <div style={{ width: 85, height: 50, background: '#f8fafc', color: '#475569', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => setStatusFilter('RFQ_TERKIRIM')}>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, color: 'var(--primary)' }}>{waiting}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>Waiting</div>
              </div>
              <div style={{ width: 85, height: 50, background: '#fef2f2', color: '#ef4444', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #fecaca', cursor: 'pointer' }}>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{late}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>Late</div>
              </div>
            </div>

            {/* Right Metrics */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 32px', fontSize: 12, color: '#475569' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 3, borderBottom: '1px solid #f1f5f9' }}>
                <span>Avg Order Value</span>
                <span className="font-bold text-dark">{fmtCurrency(avgOrderValue).replace(',00', '')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 3, borderBottom: '1px solid #f1f5f9' }}>
                <span>Purchased Last 7 Days</span>
                <span className="font-bold text-dark">{fmtCurrency(purchased7Days).replace(',00', '')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 3, borderBottom: '1px solid #f1f5f9' }}>
                <span>Lead Time to Purchase</span>
                <span className="font-bold text-dark">0.00 Days</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 3, borderBottom: '1px solid #f1f5f9' }}>
                <span>RFQs Sent Last 7 Days</span>
                <span className="font-bold text-dark">{rfqSent7Days}</span>
              </div>
            </div>
          </div>

          <div className="card-body flush table-responsive" style={{ minHeight: 400 }}>
            {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading...</div> : pos.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#64748b', fontSize: 15 }}>
                No purchase orders found
              </div>
            ) : (
              <table style={{ border: 'none' }}>
                <thead>
                  <tr style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', color: '#334155' }}>
                    <th style={{ width: 40, paddingLeft: 16 }}><input type="checkbox" /></th>
                    <th style={{ width: 30 }}></th>
                    <th>NO PO</th>
                    <th>Vendor</th>
                    <th>Order Deadline</th>
                    <th>Activities</th>
                    <th>Source Document</th>
                    <th className="right">Total</th>
                    <th className="center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map(po => {
                    const cfg = STATUS_CONFIG[po.status] ?? { label: po.status, bg: '#f1f5f9', text: '#475569' };
                    return (
                      <tr key={po.id} onClick={() => handleViewPO(po)} style={{ cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} className="hover-row">
                        <td style={{ paddingLeft: 16 }} onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
                        <td className="muted" style={{ fontSize: 16 }}>☆</td>
                        <td className="font-bold text-primary">{po.po_number}</td>
                        <td className="text-dark">{po.vendor_name}</td>
                        <td className="text-dark">{po.order_deadline ? new Date(po.order_deadline).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td className="muted">—</td>
                        <td className="muted">—</td>
                        <td className="right num text-dark font-bold">{fmtCurrency(po.total).replace(',00', '')}</td>
                        <td className="center"><span style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.text}33`, padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{cfg.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <style>{`
            .po-table-input {
              border: 1px solid transparent;
              background: transparent;
              padding: 4px 8px;
              width: 100%;
              border-radius: 4px;
              font-size: 13px;
              outline: none;
              transition: border-color 0.2s, background 0.2s;
            }
            .po-table-input:focus {
              border-color: var(--primary);
              background: #fff;
            }
            .po-table-input.ingredient-input {
              border-color: #e2e8f0;
              background: #fff;
              height: 32px;
            }
            .po-table-input.transparent-input {
              border-color: transparent;
              background: transparent;
              text-align: right;
            }
            .po-table-input.transparent-input:hover {
              background: #f8fafc;
            }
            .po-table-input.transparent-input:focus {
              border-color: #cbd5e1;
              background: #fff;
            }
            .po-table-input[type=number]::-webkit-inner-spin-button,
            .po-table-input[type=number]::-webkit-outer-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            .po-table-input[type=number] {
              -moz-appearance: textfield;
            }
          `}</style>
          <div style={{ borderBottom: '1px solid var(--border)', background: '#fff', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(!draftPO || draftPO.status === 'RFQ') && (
                  <>
                    <button className="btn btn-sm" style={{ background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600 }} onClick={() => handleSave('RFQ_TERKIRIM')} disabled={saving}>Send by Email</button>
                    <button className="btn btn-sm btn-outline" style={{ background: '#fff', color: 'var(--primary)', border: '1px solid var(--primary)', fontWeight: 600 }} onClick={() => handleSave()} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Draft'}</button>
                  </>
                )}
                {draftPO?.status === 'RFQ_TERKIRIM' && (
                  <button className="btn btn-sm" style={{ background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600 }} onClick={() => handleUpdateStatus(draftPO.id, 'PURCHASE_ORDER')} disabled={saving}>Confirm Order</button>
                )}
                {(draftPO?.status === 'PURCHASE_ORDER' || draftPO?.status === 'DITERIMA_SEBAGIAN') && (
                  <button className="btn btn-sm" style={{ background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600 }} onClick={() => {
                    // Navigate to warehouse receipt module
                    window.location.href = `/goods-receipt/receipt/${draftPO.id}`;
                  }} disabled={saving}>Receive Products</button>
                )}
                <button className="btn btn-sm btn-outline" style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 600 }} onClick={() => setShowModal(false)}>Back to list</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#64748b' }}>
                <div style={{ background: (!draftPO || draftPO.status === 'RFQ') ? 'var(--primary)' : '#f1f5f9', color: (!draftPO || draftPO.status === 'RFQ') ? '#fff' : 'inherit', padding: '4px 16px', borderRadius: 16 }}>RFQ</div>
                <div style={{ width: 24, height: 1, background: '#cbd5e1', margin: '0 4px' }} />
                <div style={{ background: draftPO?.status === 'RFQ_TERKIRIM' ? 'var(--primary)' : '#f1f5f9', color: draftPO?.status === 'RFQ_TERKIRIM' ? '#fff' : 'inherit', padding: '4px 16px', borderRadius: 16 }}>RFQ Sent</div>
                <div style={{ width: 24, height: 1, background: '#cbd5e1', margin: '0 4px' }} />
                <div style={{ background: draftPO?.status === 'PURCHASE_ORDER' ? 'var(--primary)' : '#f1f5f9', color: draftPO?.status === 'PURCHASE_ORDER' ? '#fff' : 'inherit', padding: '4px 16px', borderRadius: 16 }}>Purchase Order</div>
                <div style={{ width: 24, height: 1, background: '#cbd5e1', margin: '0 4px' }} />
                <div style={{ background: draftPO?.status === 'SELESAI' ? 'var(--primary)' : '#f1f5f9', color: draftPO?.status === 'SELESAI' ? '#fff' : 'inherit', padding: '4px 16px', borderRadius: 16 }}>Done</div>
              </div>
            </div>
          </div>
          
          <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', gap: 16, background: '#fff' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)', margin: 0, lineHeight: 1 }}>{draftPO ? draftPO.po_number : 'New'}</h1>
            <div style={{ flex: 1 }} />

          </div>
          <div className="card-body flush" style={{ padding: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {error && <div className="alert-banner alert-danger">{error}</div>}
              <fieldset disabled={draftPO ? draftPO.status !== 'RFQ' : false} style={{ border: 'none', padding: 0, margin: 0 }}>
                <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
                {/* Left Column */}
                <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label className="req">Vendor</label>
                    <select className="input" value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))}>
                      <option value="">Select vendor...</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Vendor Reference</label>
                    <input className="input" value={form.vendor_reference} onChange={e => setForm(f => ({ ...f, vendor_reference: e.target.value }))} placeholder="e.g. PO-REF-123" />
                  </div>
                </div>

                {/* Right Column */}
                <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label>Deliver To</label>
                    <input className="input" value={form.deliver_to} onFocus={(e) => { setDeliverToFocused(true); e.target.select(); }} onBlur={() => setTimeout(() => setDeliverToFocused(false), 200)} onChange={e => {
                      const val = e.target.value;
                      const matched = outlets.find(o => o.name === val);
                      setForm(f => ({ ...f, deliver_to: val, destination_outlet_id: matched ? String(matched.id) : '' }));
                    }} placeholder="Select or type destination..." />
                    
                    {deliverToFocused && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--primary)', borderRadius: 4, maxHeight: 200, overflowY: 'auto', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 2 }}>
                        {[{ name: 'Gudang Cihapit', id: 'gudang' }, ...outlets].filter(o => o.name.toLowerCase().includes(form.deliver_to.toLowerCase())).map((o: any) => (
                          <div key={o.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#1e293b', borderBottom: '1px solid #f8fafc' }} onClick={() => {
                            setForm(f => ({ ...f, deliver_to: o.name, destination_outlet_id: o.id === 'gudang' ? '' : String(o.id) }));
                            setDeliverToFocused(false);
                          }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {o.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                      <label>Order Date</label>
                      <input className="input" type="date" min={new Date().toISOString().split('T')[0]} value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} onKeyDown={e => e.preventDefault()} onClick={e => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()} />
                    </div>
                    <div className="form-group">
                      <label>Order Deadline</label>
                      <input className="input" type="date" min={new Date().toISOString().split('T')[0]} value={form.order_deadline} onChange={e => setForm(f => ({ ...f, order_deadline: e.target.value }))} onKeyDown={e => e.preventDefault()} onClick={e => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Payment Terms</label>
                    <input className="input" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="e.g. 30 days, Cash" />
                  </div>
                </div>
              </div>

              {/* Odoo Style Tabs */}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0, marginBottom: 16 }}>
                  {['Ingredients', 'Other Info', 'Alternatives'].map(tab => (
                    <div key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        padding: '8px 4px',
                        cursor: 'pointer',
                        color: activeTab === tab ? 'var(--primary)' : '#64748b',
                        fontWeight: activeTab === tab ? 600 : 500,
                        borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                        marginBottom: -1
                      }}>
                      {tab}
                    </div>
                  ))}
                </div>

                {activeTab === 'Ingredients' && (
                  <div>
                    <div className="table-responsive" style={{ overflow: 'visible', border: '1px solid var(--border)', borderRadius: 8, background: '#f8fafc' }}>
                      <table style={{ margin: 0 }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>
                            <th style={{ padding: '12px 16px', minWidth: 350 }}>Ingredient</th>
                            <th className="right">Quantity</th>
                            <th className="right">Unit</th>
                            <th className="right">Unit Price</th>
                            <th className="right">Taxes %</th>
                            <th className="right">Disc.%</th>
                            <th className="right">Amount</th>
                            <th style={{ width: 40 }}></th>
                          </tr>
                        </thead>
                        <tbody style={{ background: '#fff' }}>
                          {lines.map((line, idx) => {
                            if (line.type === 'note') {
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '8px 16px' }}>
                                    <textarea className="input" rows={2} style={{ width: '100%', resize: 'none', fontStyle: 'italic', fontSize: 13 }} placeholder="Type a note..." value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} />
                                  </td>
                                  <td colSpan={6}></td>
                                  <td className="center" style={{ padding: '6px 4px' }}>
                                    <button onClick={() => removeLine(idx)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                    </button>
                                  </td>
                                </tr>
                              );
                            }
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 16px', position: 'relative' }}>
                                  <input
                                    className="po-table-input ingredient-input"
                                    value={line.description}
                                    onFocus={(e) => { setActiveDropdown(idx); e.target.select(); }}
                                    onBlur={() => setTimeout(() => setActiveDropdown(null), 200)}
                                    onChange={e => handleItemTextChange(idx, e.target.value)}
                                    placeholder="Ingredient name..."
                                  />
                                  {activeDropdown === idx && (
                                    <div style={{ position: 'absolute', top: '100%', left: 16, right: 16, background: '#fff', border: '1px solid var(--primary)', borderRadius: 4, maxHeight: 200, overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 2 }}>
                                      {items.filter(i => i.name.toLowerCase().includes((line.item_id ? '' : line.description).toLowerCase())).map(i => (
                                        <div key={i.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#1e293b', borderBottom: '1px solid #f8fafc' }} onClick={() => {
                                          handleItemTextChange(idx, i.name);
                                          setActiveDropdown(null);
                                        }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                          {i.name}
                                        </div>
                                      ))}
                                      {items.filter(i => i.name.toLowerCase().includes((line.item_id ? '' : line.description).toLowerCase())).length === 0 && (
                                        <div style={{ padding: '8px 12px', color: '#64748b', fontStyle: 'italic', fontSize: 13 }}>No matches found</div>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '6px 16px' }}>
                                  <input type="text" className="po-table-input transparent-input right" value={line.qty === '0' ? '' : (line.qty ? Number(line.qty).toLocaleString('id-ID') : '')} onChange={e => { const raw = e.target.value.replace(/\./g, ''); if (/^\d*$/.test(raw)) updateLine(idx, 'qty', raw); }} onFocus={e => e.target.select()} placeholder="0" />
                                </td>
                                <td className="right" style={{ padding: '6px 16px', color: '#64748b' }}>
                                  {line.item_id ? items.find(i => String(i.id) === line.item_id)?.purchase_unit : 'pcs'}
                                </td>
                                <td style={{ padding: '6px 16px' }}>
                                  <input type="text" className="po-table-input transparent-input right" value={line.unit_price === '0' ? '' : (line.unit_price ? Number(line.unit_price).toLocaleString('id-ID') : '')} onChange={e => { const raw = e.target.value.replace(/\./g, ''); if (/^\d*$/.test(raw)) updateLine(idx, 'unit_price', raw); }} onFocus={e => e.target.select()} placeholder="0" />
                                </td>
                                <td style={{ padding: '6px 16px' }}>
                                  <input type="text" className="po-table-input transparent-input right" value={line.tax_percent === '0' ? '' : (line.tax_percent ? Number(line.tax_percent).toLocaleString('id-ID') : '')} onChange={e => { const raw = e.target.value.replace(/\./g, ''); if (/^\d*$/.test(raw)) updateLine(idx, 'tax_percent', raw); }} onFocus={e => e.target.select()} placeholder="0" />
                                </td>
                                <td style={{ padding: '6px 16px' }}>
                                  <input type="text" className="po-table-input transparent-input right" value={line.disc_percent === '0' ? '' : (line.disc_percent ? Number(line.disc_percent).toLocaleString('id-ID') : '')} onChange={e => { const raw = e.target.value.replace(/\./g, ''); if (/^\d*$/.test(raw)) updateLine(idx, 'disc_percent', raw); }} onFocus={e => e.target.select()} placeholder="0" />
                                </td>
                                <td style={{ padding: '6px 16px' }}>
                                  <input 
                                    type="text" 
                                    className="po-table-input transparent-input right font-bold" 
                                    value={(() => {
                                      const amt = (Number(line.qty) || 0) * (Number(line.unit_price) || 0) * (1 - (Number(line.disc_percent) || 0) / 100);
                                      return amt ? Math.round(amt).toLocaleString('id-ID') : '';
                                    })()} 
                                    onChange={e => {
                                      const raw = e.target.value.replace(/\./g, '');
                                      if (/^\d*$/.test(raw)) {
                                        const amount = Number(raw) || 0;
                                        const qty = Number(line.qty) || 1; // hindari bagi nol
                                        const d = Number(line.disc_percent) || 0;
                                        const factor = qty * (1 - d/100);
                                        const newUnitPrice = Math.round(factor > 0 ? amount / factor : 0);
                                        updateLine(idx, 'unit_price', String(newUnitPrice));
                                      }
                                    }} 
                                    onFocus={e => e.target.select()} 
                                    placeholder="0" 
                                  />
                                </td>
                                <td className="center" style={{ padding: '6px 4px' }}>
                                  <button onClick={() => removeLine(idx)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="btn btn-sm btn-outline" style={{ background: '#fff', color: 'var(--primary)', border: '1px solid var(--primary)', fontWeight: 600 }} onClick={addLine}>Add an ingredient</button>
                      <button className="btn btn-sm btn-outline" style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 600 }}>Add a section</button>
                      <button className="btn btn-sm btn-outline" style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 600 }} onClick={addNote}>Add a note</button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', marginTop: 32 }}>
                      <div style={{ minWidth: 300 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: '#64748b' }}>
                          <span>Untaxed Amount:</span>
                          <span className="num">{fmtCurrency(computedSubtotal).replace(',00', '')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, color: '#64748b' }}>
                          <span>Taxes:</span>
                          <span className="num">{fmtCurrency(computedTax).replace(',00', '')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 18 }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Total:</span>
                          <span className="num font-bold text-dark">{fmtCurrency(computedTotal).replace(',00', '')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'Other Info' && (
                  <div className="form-grid" style={{ columnGap: 60 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: 140, fontWeight: 600, fontSize: 13, color: '#475569' }}>Purchase Rep</div>
                        <input className="input" value="Admin Pusat" disabled style={{ flex: 1 }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: 140, fontWeight: 600, fontSize: 13, color: '#475569' }}>Company</div>
                        <input className="input" value="Sunrise Daily Pusat" disabled style={{ flex: 1 }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: 140, fontWeight: 600, fontSize: 13, color: '#475569' }}>Source Document</div>
                        <input className="input" placeholder="e.g. OP/0001" style={{ flex: 1 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: 140, fontWeight: 600, fontSize: 13, color: '#475569' }}>Agreement</div>
                        <input className="input" style={{ flex: 1 }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: 140, fontWeight: 600, fontSize: 13, color: '#475569' }}>Payment Terms</div>
                        <select className="input" style={{ flex: 1 }} value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
                          <option value="">Immediate Payment</option>
                          <option value="15 Days">15 Days</option>
                          <option value="30 Days">30 Days</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              </fieldset>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SettingsTabs } from '@/components/ui/SettingsTabs';
import { Toast } from '@/components/ui/Toast';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' as any });
  const [settings, setSettings] = useState({
    company_name: '',
    notification_email: '',
    company_phone: '',
    company_tax_id: '',
    company_website: '',
    bank_account_info: '',
    warehouse_address: '',
    require_barcode_scan: 'true'
  });

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setSettings({
            company_name: data.data.company_name || '',
            notification_email: data.data.notification_email || '',
            company_phone: data.data.company_phone || '',
            company_tax_id: data.data.company_tax_id || '',
            company_website: data.data.company_website || '',
            bank_account_info: data.data.bank_account_info || '',
            warehouse_address: data.data.warehouse_address || '',
            require_barcode_scan: data.data.require_barcode_scan !== undefined ? data.data.require_barcode_scan : 'true'
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setToast({ open: true, message: 'Profil perusahaan berhasil disimpan!', type: 'success' });
      } else {
        setToast({ open: true, message: data.message || 'Gagal menyimpan pengaturan', type: 'error' });
      }
    } catch (e) {
      setToast({ open: true, message: 'Terjadi kesalahan sistem', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="screen">
      <SettingsTabs />
      <Toast isOpen={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, open: false })} />

      <div className="card" style={{ maxWidth: 540, margin: '0 auto', boxShadow: '0 2px 12px rgba(0,0,0,0.03)' }}>
        <div className="card-head" style={{ padding: '10px 14px' }}>
          <div>
            <h3 style={{ fontSize: '13px', margin: 0, fontWeight: 700 }}>Profil Perusahaan</h3>
            <p className="text-muted" style={{ fontSize: '10px', marginTop: '1px', marginBottom: 0 }}>Pengaturan profil dan identitas aplikasi.</p>
          </div>
        </div>
        
        <div className="card-body" style={{ padding: '12px 14px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#64748b', fontSize: 12 }}>
              Memuat pengaturan...
            </div>
          ) : (
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-3">
                <div className="form-group mb-0 md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 block">Nama Perusahaan</label>
                  <Input 
                    value={settings.company_name} 
                    onChange={e => setSettings({...settings, company_name: e.target.value})} 
                    required 
                    style={{ height: 30, fontSize: 11 }}
                  />
                </div>
                
                <div className="form-group mb-0">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 block">Nomor Telepon</label>
                  <Input 
                    type="text" 
                    value={settings.company_phone} 
                    onChange={e => setSettings({...settings, company_phone: e.target.value})} 
                    style={{ height: 30, fontSize: 11 }}
                  />
                </div>

                <div className="form-group mb-0">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 block">Email Notifikasi Pusat</label>
                  <Input 
                    type="email" 
                    value={settings.notification_email} 
                    onChange={e => setSettings({...settings, notification_email: e.target.value})} 
                    style={{ height: 30, fontSize: 11 }}
                  />
                </div>

                <div className="form-group mb-0">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 block">NPWP</label>
                  <Input 
                    type="text" 
                    value={settings.company_tax_id} 
                    onChange={e => setSettings({...settings, company_tax_id: e.target.value})} 
                    style={{ height: 30, fontSize: 11 }}
                  />
                </div>

                <div className="form-group mb-0">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 block">Website</label>
                  <Input 
                    type="text" 
                    value={settings.company_website} 
                    onChange={e => setSettings({...settings, company_website: e.target.value})} 
                    style={{ height: 30, fontSize: 11 }}
                  />
                </div>

                <div className="form-group mb-0 md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 block">Informasi Rekening Bank</label>
                  <textarea 
                    className="form-control text-xs" 
                    rows={2}
                    value={settings.bank_account_info} 
                    onChange={e => setSettings({...settings, bank_account_info: e.target.value})} 
                    placeholder="Contoh: Bank BCA - 1234567890 a.n. PT Sunrise Daily"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  />
                  <p className="text-muted" style={{ fontSize: '10px', marginTop: '2px', marginBottom: 0 }}>Informasi ini mungkin digunakan untuk referensi transfer internal atau instruksi pembayaran.</p>
                </div>

                <div className="form-group mb-0 md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 block">Alamat Lengkap Gudang Pusat</label>
                  <textarea 
                    className="form-control text-xs" 
                    rows={2}
                    value={settings.warehouse_address} 
                    onChange={e => setSettings({...settings, warehouse_address: e.target.value})} 
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  />
                  <p className="text-muted" style={{ fontSize: '10px', marginTop: '2px', marginBottom: 0 }}>Alamat ini akan dicetak pada bagian atas Surat Jalan dan Purchase Orders (PO).</p>
                </div>
              </div>

            {/* Pengaturan Operasional */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
              <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4">PENGATURAN OPERASIONAL</h2>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative', flexShrink: 0, marginTop: 2 }}>
                  <input 
                    type="checkbox" 
                    id="require_barcode_scan"
                    checked={settings.require_barcode_scan === 'true'}
                    onChange={e => setSettings({...settings, require_barcode_scan: e.target.checked ? 'true' : 'false'})}
                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                  />
                  <div style={{
                    width: 40, height: 22, background: settings.require_barcode_scan === 'true' ? 'var(--primary)' : '#cbd5e1',
                    borderRadius: 22, position: 'relative', transition: 'background-color 0.3s'
                  }}>
                    <div style={{
                      width: 18, height: 18, background: '#fff', borderRadius: '50%',
                      position: 'absolute', top: 2, left: settings.require_barcode_scan === 'true' ? 20 : 2, transition: 'left 0.3s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                    }}/>
                  </div>
                </label>
                <div>
                  <label htmlFor="require_barcode_scan" className="text-[13px] font-bold text-gray-800 mb-1 cursor-pointer block">Wajibkan Scan Barcode (Pengiriman & Penerimaan)</label>
                  <p className="text-muted" style={{ fontSize: '12px', marginTop: '2px', marginBottom: 0, lineHeight: 1.5, color: '#64748b' }}>
                    Jika dimatikan, staf Pusat dan Outlet dapat mengklik tombol "Kirim Semua Barang" atau "Terima Semua Barang" untuk mempercepat operasional tanpa harus *scan* barcode satu per satu. Fitur unggah bukti foto juga akan menjadi opsional.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <Button variant="primary" type="submit" disabled={saving} style={{ padding: '0 16px', height: 28, fontSize: 11 }}>
                  {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

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
    warehouse_address: ''
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
            warehouse_address: data.data.warehouse_address || ''
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
        setToast({ open: true, message: 'Company profile successfully saved!', type: 'success' });
      } else {
        setToast({ open: true, message: data.message || 'Failed to save settings', type: 'error' });
      }
    } catch (e) {
      setToast({ open: true, message: 'System error occurred', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="screen">
      <SettingsTabs />
      <Toast isOpen={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, open: false })} />
      
      <div className="card" style={{ maxWidth: 640, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <div className="card-head" style={{ padding: '20px 24px' }}>
          <div>
            <h3 style={{ fontSize: 18, color: '#0f172a' }}>Company Profile</h3>
            <p className="text-muted" style={{ marginTop: 4, fontSize: 13 }}>Application profile and identity settings.</p>
          </div>
        </div>
        
        <div className="card-body" style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: 14 }}>
              Loading settings...
            </div>
          ) : (
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 28 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>Company Name</label>
                  <Input 
                    value={settings.company_name} 
                    onChange={e => setSettings({...settings, company_name: e.target.value})} 
                    required 
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>Phone Number</label>
                    <Input 
                      type="text" 
                      value={settings.company_phone} 
                      onChange={e => setSettings({...settings, company_phone: e.target.value})} 
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>HQ Notification Email</label>
                    <Input 
                      type="email" 
                      value={settings.notification_email} 
                      onChange={e => setSettings({...settings, notification_email: e.target.value})} 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>Tax ID (NPWP)</label>
                    <Input 
                      type="text" 
                      value={settings.company_tax_id} 
                      onChange={e => setSettings({...settings, company_tax_id: e.target.value})} 
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>Website</label>
                    <Input 
                      type="text" 
                      value={settings.company_website} 
                      onChange={e => setSettings({...settings, company_website: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>Bank Account Information</label>
                  <textarea 
                    className="form-control" 
                    rows={2}
                    value={settings.bank_account_info} 
                    onChange={e => setSettings({...settings, bank_account_info: e.target.value})} 
                    placeholder="e.g. Bank BCA - 1234567890 a.n. PT Sunrise Daily"
                  />
                  <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>This information may be used for internal transfer references or payment instructions.</p>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>Central Warehouse Full Address</label>
                  <textarea 
                    className="form-control" 
                    rows={3}
                    value={settings.warehouse_address} 
                    onChange={e => setSettings({...settings, warehouse_address: e.target.value})} 
                  />
                  <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>This address will be printed on the header of Delivery Notes and Purchase Orders (PO).</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Button variant="primary" type="submit" disabled={saving} style={{ padding: '0 32px', height: 42, fontSize: 14 }}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

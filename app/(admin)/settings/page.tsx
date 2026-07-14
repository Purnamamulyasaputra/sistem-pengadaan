'use client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SettingsPage() {
  return (
    <section className="screen">
      <div className="card" style={{ maxWidth: 600 }}>
        <div className="card-head">
          <div>
            <h3>System Settings</h3>
          </div>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label>Company Name</label>
            <Input defaultValue="Sunrise Daily" />
          </div>
          <div className="form-group">
            <label>Central Notification Email</label>
            <Input type="email" defaultValue="admin@sunrisedaily.com" />
          </div>
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary">Save Settings</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

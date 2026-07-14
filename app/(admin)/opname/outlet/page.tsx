'use client';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';

export default function OutletOpnamePage() {
  return (
    <section className="screen">
      <div className="card">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <a href="/opname/outlet" className="tab active" style={{ textDecoration: 'none' }}>Stock Opname</a>
          <a href="/outlet/items" className="tab" style={{ textDecoration: 'none', color: 'inherit' }}>Item Reference</a>
        </div>
        <div className="card-head">
          <div>
            <h3>Outlet Stock Opname & Usage</h3>
          </div>
          <Button variant="primary" size="sm">+ Start Daily Report</Button>
        </div>
        <div className="card-body flush">
          <Table>
            <thead>
              <tr>
                <th>Report Date</th>
                <th>Opname Type</th>
                <th className="right">Total Usage Value</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="center muted" style={{ padding: 32 }}>No outlet opname history yet.</td>
              </tr>
            </tbody>
          </Table>
        </div>
      </div>
    </section>
  );
}

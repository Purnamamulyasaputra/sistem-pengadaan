'use client';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';

export default function ProcurementPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => setLoading(false), 500);
  }, []);

  return (
    <section className="screen">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Procurement Module</h3>
            <p>Kelola perubahan status pengadaan barang ke vendor.</p>
          </div>
          <button className="btn btn-primary btn-sm">+ Buat PO Baru</button>
        </div>
        <div className="card-body flush">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Memuat...</div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>No. PO</th>
                  <th>Vendor</th>
                  <th>Tanggal</th>
                  <th className="right">Total Nilai</th>
                  <th className="center">Status</th>
                  <th className="right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="center muted" style={{ padding: 32 }}>Belum ada data pengadaan.</td>
                </tr>
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </section>
  );
}

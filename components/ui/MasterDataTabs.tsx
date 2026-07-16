'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function MasterDataTabs({ activeTab }: { activeTab: 'items' | 'categories' | 'outlets' | 'vendors' }) {
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const count = data.data.filter((i: any) => Number(i.current_stock ?? 0) < Number(i.minimum_threshold)).length;
          setLowStockCount(count);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="tabs" style={{ marginBottom: 0 }}>
      <Link href="/master-data/items" className={`tab ${activeTab === 'items' ? 'active' : ''}`} style={{ textDecoration: 'none', color: activeTab === 'items' ? undefined : 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
        Items
        {lowStockCount > 0 && (
          <span className="nav-badge" style={{ marginLeft: 0 }}>
            {lowStockCount}
          </span>
        )}
      </Link>
      <Link href="/master-data/categories" className={`tab ${activeTab === 'categories' ? 'active' : ''}`} style={{ textDecoration: 'none', color: activeTab === 'categories' ? undefined : 'inherit' }}>Categories</Link>
      <Link href="/master-data/outlets" className={`tab ${activeTab === 'outlets' ? 'active' : ''}`} style={{ textDecoration: 'none', color: activeTab === 'outlets' ? undefined : 'inherit' }}>Outlets</Link>
      <Link href="/master-data/vendors" className={`tab ${activeTab === 'vendors' ? 'active' : ''}`} style={{ textDecoration: 'none', color: activeTab === 'vendors' ? undefined : 'inherit' }}>Vendors</Link>
    </div>
  );
}

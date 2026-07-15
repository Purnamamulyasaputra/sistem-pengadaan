'use client';
import { usePathname } from 'next/navigation';

interface TopBarProps {
  user: {
    name: string;
    role: string;
    outletId: number | null;
  };
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/requests/create': 'Create Request',
  '/requests': 'Request Recap',
  '/purchase-orders': 'Purchase Order',
  '/goods-receipt': 'Goods Receipt',
  '/stock-card': 'Stock Card',
  '/delivery-orders': 'Delivery Orders',
  '/opname/central': 'Central Stock Opname',
  '/outlet/opname': 'Outlet Stock Opname',
  '/alerts': 'Reorder Point',
  '/price-history': 'Price History',
  '/reports': 'Financial Report',
  '/master-data': 'Master Data Hub',
  '/master-data/items': 'Master Items',
  '/master-data/outlets': 'Master Outlets',
  '/master-data/vendors': 'Master Vendors',
  '/master-data/categories': 'Master Categories',
  '/settings/profile': 'Profile & Account',
  '/settings': 'System Settings',
  '/receive-goods': 'Receive Goods',
};

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function TopBar({ user }: TopBarProps) {
  const pathname = usePathname();

  // Find best matching title
  let title = 'Sistem Pengadaan';
  let bestLen = 0;
  for (const [path, t] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(path) && path.length > bestLen) {
      title = t;
      bestLen = path.length;
    }
  }

  const roleLabel = user.role === 'ADMIN_PUSAT' ? 'Admin Pusat' : 'Admin Outlet';

  return (
    <header className="topbar no-print">
      <div
        className="hamburger"
        onClick={() => {
          const ham = document.getElementById('mobile-hamburger');
          ham && ham.click();
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
      </div>

      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-sub">{roleLabel} • Sunrise Daily</p>
      </div>

      <div className="topbar-right">
        <div className="bell-wrap">
          <div className="bell">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            <div className="dot">!</div>
          </div>
        </div>

        <div className="avatar">{getInitials(user.name)}</div>
        <div className="who">
          <span className="name">{user.name}</span>
          <span className="role">{roleLabel}</span>
        </div>
      </div>
    </header>
  );
}

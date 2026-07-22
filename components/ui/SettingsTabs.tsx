'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="tabs" style={{ marginBottom: 24 }}>
      <Link 
        href="/settings" 
        className={`tab ${pathname === '/settings' ? 'active' : ''}`} 
        style={{ textDecoration: 'none', color: pathname === '/settings' ? undefined : 'inherit' }}
      >
        Company Profile
      </Link>


      <Link 
        href="/settings/users" 
        className={`tab ${pathname.startsWith('/settings/users') ? 'active' : ''}`} 
        style={{ textDecoration: 'none', color: pathname.startsWith('/settings/users') ? undefined : 'inherit' }}
      >
        User Management
      </Link>
    </div>
  );
}

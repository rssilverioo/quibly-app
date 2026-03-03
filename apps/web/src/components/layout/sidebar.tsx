'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/revenue', label: 'Revenue', icon: '💰' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/content', label: 'Content', icon: '📚' },
  { href: '/admin/leagues', label: 'Leagues', icon: '🏆' },
  { href: '/admin/notifications', label: 'Notifications', icon: '🔔' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-quibly-surface border-r border-quibly-border min-h-screen flex flex-col">
      <div className="p-6 border-b border-quibly-border">
        <h1 className="text-xl font-bold text-quibly-text">Quibly</h1>
        <p className="text-xs text-quibly-text-muted mt-1">Admin Panel</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-quibly-primary/20 text-quibly-primary-light'
                  : 'text-quibly-text-secondary hover:bg-quibly-surface-light hover:text-quibly-text',
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

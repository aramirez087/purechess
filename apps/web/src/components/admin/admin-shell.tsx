'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/games', label: 'Games' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/queues', label: 'Queues' },
  { href: '/admin/audit', label: 'Audit Log' },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="w-52 shrink-0 border-r bg-muted/30 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Admin
        </p>
        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                pathname.startsWith(href) && 'bg-accent text-accent-foreground font-medium',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}

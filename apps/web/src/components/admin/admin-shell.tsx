'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';

const navItems = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/games', label: 'Games' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/queues', label: 'Queues' },
  { href: '/admin/audit', label: 'Audit log' },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-stage md:flex-row">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/70 bg-surface/60 backdrop-blur-sm md:flex">
        <div className="flex h-top-bar items-center border-b border-border/60 px-5">
          <Logo size="sm" tone="brass" />
        </div>
        <div className="px-5 pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Admin Console
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            Mod tools, metrics, audit
          </p>
        </div>
        <nav className="mt-5 flex-1 px-3" aria-label="Admin">
          {navItems.map(({ href, label }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brass/10 text-foreground'
                    : 'text-muted-foreground hover:bg-raised hover:text-foreground'
                }`}
              >
                {label}
                {active && (
                  <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-brass" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border/60 p-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-raised hover:text-foreground"
          >
            <ChevronRight className="h-3 w-3 rotate-180" />
            Back to app
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-top-bar items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-md md:hidden">
        <Logo size="sm" tone="brass" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brass">
          Admin
        </span>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}

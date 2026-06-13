import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { MobileNav } from './MobileNav';
import { UserMenu } from './UserMenu';
import { SettingsDialog } from '@/components/settings/settings-dialog';

const navLinks = [
  { href: '/play', label: 'Play' },
  { href: '/puzzles', label: 'Puzzles' },
  { href: '/games', label: 'Games' },
];

type AppShellProps = {
  variant?: 'default' | 'minimal';
  children: ReactNode;
  /** Optional accent under the top bar — e.g. "Live", "In game" — to hint context. */
  contextBadge?: string;
};

export function AppShell({ variant = 'default', children, contextBadge }: AppShellProps) {
  if (variant === 'minimal') {
    return (
      <div className="min-h-screen flex flex-col bg-stage">
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 flex flex-col"
        >
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-stage">
      <header
        className={cn(
          'sticky top-0 z-40 h-top-bar shrink-0',
          'border-b border-border/70',
          'bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60',
        )}
      >
        <div className="mx-auto flex h-full max-w-[1600px] items-center gap-6 px-4 sm:px-6">
          <Link
            href="/"
            className="group flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Logo size="sm" />
          </Link>

          {contextBadge ? (
            <span
              className={cn(
                'hidden sm:inline-flex items-center gap-1.5 rounded-full',
                'border border-brass/40 bg-brass-soft/40 px-2.5 py-0.5',
                'text-[11px] font-medium uppercase tracking-[0.12em] text-brass-text',
              )}
            >
              <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping motion-reduce:animate-none rounded-full bg-brass opacity-60 motion-reduce:opacity-100" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brass" />
              </span>
              {contextBadge}
            </span>
          ) : null}

          <nav className="hidden md:flex items-center gap-1 ml-2" aria-label="Primary">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium',
                  'text-muted-foreground hover:text-foreground hover:bg-raised',
                  'transition-colors',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <SettingsDialog />
            <UserMenu />
            <MobileNav />
          </div>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col min-h-0"
      >
        {children}
      </main>
    </div>
  );
}

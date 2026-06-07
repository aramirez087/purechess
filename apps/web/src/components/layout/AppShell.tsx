import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { MobileNav } from './MobileNav';
import { UserMenu } from './UserMenu';
import { SettingsDialog } from '@/components/settings/settings-dialog';

const navLinks = [
  { href: '/play', label: 'Play' },
  { href: '/games', label: 'Games' },
  { href: '/profile', label: 'Profile' },
];

type AppShellProps = {
  variant?: 'default' | 'minimal';
  children: ReactNode;
};

export function AppShell({ variant = 'default', children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {variant === 'default' && (
        <header className="h-12 border-b border-border bg-background flex items-center px-4 shrink-0">
          <div className="flex items-center gap-6 flex-1">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Logo />
            </Link>
            <nav className="hidden sm:flex items-center gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <SettingsDialog />
            <UserMenu user={null} />
            <MobileNav />
          </div>
        </header>
      )}
      <main
        id="main-content"
        className={cn('flex-1', variant === 'minimal' && 'flex flex-col')}
      >
        {children}
      </main>
    </div>
  );
}

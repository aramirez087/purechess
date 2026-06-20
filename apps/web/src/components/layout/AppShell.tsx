import type { ReactNode } from 'react';
import Link from 'next/link';
import { Target, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { MobileNav } from './MobileNav';
import { UserMenu } from './UserMenu';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { Button } from '@/components/ui/button';

const navLinks = [
  { href: '/play', label: 'Play' },
  // Improve surface — hub at /train; /puzzles /openings /endgames reachable from it.
  { href: '/train', label: 'Train', icon: Target },
  { href: '/puzzles', label: 'Puzzles' },
  { href: '/games', label: 'Games' },
  // Paste-a-game / FEN study — pairs with Games (your history) as the review cluster.
  { href: '/analyze', label: 'Analyze' },
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
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
                    'text-muted-foreground hover:text-foreground hover:bg-raised',
                    'transition-colors',
                  )}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> : null}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Button
              asChild
              size="sm"
              className="hidden h-8 gap-1.5 bg-foreground px-3.5 text-background hover:bg-foreground/90 sm:inline-flex"
            >
              <Link href="/play/quick">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                Play
              </Link>
            </Button>
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

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';
import { Menu, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  // Repertoire (/openings) vs Opening Lab (/openings/lab) share a prefix.
  if (href === '/openings') {
    return pathname.startsWith('/openings/') && !pathname.startsWith('/openings/lab');
  }
  return pathname.startsWith(`${href}/`);
}

const navLinks = [
  { href: '/play', label: 'Play' },
  // Improve surface.
  { href: '/train', label: 'Train' },
  { href: '/puzzles', label: 'Puzzles' },
  { href: '/openings', label: 'Repertoire' },
  { href: '/openings/lab', label: 'Opening Lab' },
  { href: '/endgames', label: 'Endgames' },
  { href: '/games', label: 'Games' },
  { href: '/analyze', label: 'Analyze' },
  { href: '/profile', label: 'Profile' },
  { href: '/settings', label: 'Settings' },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border/60 px-5 py-4">
          <SheetTitle asChild>
            <Logo size="sm" />
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-0.5 p-3" aria-label="Mobile">
          <Link
            href="/play/quick"
            onClick={() => setOpen(false)}
            className="mb-2 flex items-center justify-center gap-2 rounded-md bg-foreground px-3 py-2.5 text-sm font-semibold text-background"
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            Play now
          </Link>
          {navLinks.map((link) => {
            const active = isNavActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium',
                  'transition-colors',
                  active
                    ? 'bg-raised text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-raised',
                )}
              >
                {link.label}
                {active && <span className="h-1.5 w-1.5 rounded-full bg-brass" />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-5 border-t border-border/60">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
            Purechess
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pure chess. Nothing else.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

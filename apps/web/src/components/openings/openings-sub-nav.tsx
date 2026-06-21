'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  {
    href: '/openings',
    label: 'Repertoire',
    match: (path: string) => path === '/openings',
  },
  {
    href: '/openings/lab',
    label: 'Opening Lab',
    match: (path: string) => path.startsWith('/openings/lab'),
  },
] as const;

export function OpeningsSubNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav
      aria-label="Opening modes"
      className="mx-auto flex w-full max-w-[1500px] flex-wrap gap-1.5 px-4 pt-6 sm:px-6 lg:px-8"
    >
      {LINKS.map(({ href, label, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-8 items-center rounded-full border px-3.5 text-xs font-medium transition-colors',
              active
                ? 'border-brass/50 bg-brass/10 text-foreground'
                : 'border-border/70 bg-surface/50 text-muted-foreground hover:border-brass/40 hover:text-foreground',
            )}
          >
            {label}
          </Link>
        );
      })}
      <Link
        href="/train"
        className="ml-auto inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        All training →
      </Link>
    </nav>
  );
}
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isNavActive, PRIMARY_NAV_LINKS } from './nav-links';

export function PrimaryNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {PRIMARY_NAV_LINKS.map((link) => {
        const Icon = link.icon;
        const active = isNavActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-raised text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-raised',
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> : null}
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
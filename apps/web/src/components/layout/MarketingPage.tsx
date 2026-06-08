import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MarketingPage({
  children,
  className,
  width = 'default',
}: {
  children: ReactNode;
  className?: string;
  width?: 'default' | 'wide' | 'narrow';
}) {
  const max =
    width === 'wide' ? 'max-w-6xl' : width === 'narrow' ? 'max-w-2xl' : 'max-w-4xl';
  return <div className={cn('mx-auto w-full px-4 sm:px-6 py-12', max, className)}>{children}</div>;
}

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MarketingPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto max-w-4xl px-6 py-12', className)}>
      {children}
    </div>
  );
}

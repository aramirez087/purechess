'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CtaButtonProps = {
  variant: 'primary' | 'secondary' | 'tertiary';
  href?: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export function CtaButton({ variant, href, disabled, className, children }: CtaButtonProps) {
  const shadcnVariant =
    variant === 'primary' ? 'default' : variant === 'secondary' ? 'outline' : 'ghost';
  const size = variant === 'tertiary' ? 'sm' : 'lg';
  const fullWidth = variant === 'primary' ? 'w-full sm:w-auto' : undefined;

  if (href && !disabled) {
    return (
      <Button asChild variant={shadcnVariant} size={size} className={cn(fullWidth, className)}>
        <Link href={href}>{children}</Link>
      </Button>
    );
  }

  return (
    <Button
      variant={shadcnVariant}
      size={size}
      disabled={disabled}
      className={cn(fullWidth, className)}
    >
      {children}
    </Button>
  );
}

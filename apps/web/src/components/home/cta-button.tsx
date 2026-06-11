import Link from 'next/link';
import { Button } from '@/components/ui/button';

type CtaButtonProps = {
  variant: 'primary' | 'secondary' | 'tertiary';
  href?: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

const VARIANT_CLASSES: Record<CtaButtonProps['variant'], string> = {
  primary:
    'group h-12 w-full px-7 text-[15px] font-medium bg-foreground text-background shadow-elevated transition-[box-shadow,transform,background-color] duration-200 hover:bg-foreground/90 hover:shadow-brass-glow hover:-translate-y-px active:translate-y-0 active:shadow-none sm:w-auto',
  secondary: 'h-12 w-full px-7 text-[15px] font-medium border-border/80 hover:bg-raised sm:w-auto',
  tertiary: 'text-muted-foreground',
};

export function CtaButton({ variant, href, disabled, className, children }: CtaButtonProps) {
  const size = variant === 'tertiary' ? 'sm' : 'lg';
  const buttonVariant =
    variant === 'primary' ? 'default' : variant === 'secondary' ? 'outline' : 'ghost';

  if (href && !disabled) {
    return (
      <Button
        asChild={false}
        variant={buttonVariant}
        size={size}
        className={[VARIANT_CLASSES[variant], className].filter(Boolean).join(' ')}
      >
        <Link href={href} className="inline-flex items-center">
          {children}
        </Link>
      </Button>
    );
  }

  // Disabled CTAs keep full-opacity muted text for AA contrast: aria-disabled +
  // pointer-events-none instead of the native attribute (which forces opacity-50).
  return (
    <Button
      variant={buttonVariant}
      size={size}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={[VARIANT_CLASSES[variant], disabled && 'pointer-events-none', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Button>
  );
}

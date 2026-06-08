import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type CtaButtonProps = {
  variant: 'primary' | 'secondary' | 'tertiary';
  href?: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function CtaButton({ variant, href, disabled, className, children }: CtaButtonProps) {
  const size = variant === 'tertiary' ? 'sm' : 'lg';

  if (href && !disabled) {
    return (
      <Button
        asChild={false}
        variant={variant === 'primary' ? 'default' : variant === 'secondary' ? 'outline' : 'ghost'}
        size={size}
        className={[
          variant === 'primary' &&
            'h-12 px-7 text-[15px] font-medium bg-foreground text-background hover:bg-foreground/90 shadow-elevated',
          variant === 'secondary' &&
            'h-12 px-7 text-[15px] font-medium border-border/80 hover:bg-raised',
          variant === 'tertiary' && 'text-muted-foreground',
          variant === 'primary' && 'w-full sm:w-auto',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Link href={href} className="inline-flex items-center">
          {children}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant={variant === 'primary' ? 'default' : variant === 'secondary' ? 'outline' : 'ghost'}
      size={size}
      disabled={disabled}
      className={[
        variant === 'primary' &&
          'h-12 px-7 text-[15px] font-medium bg-foreground text-background hover:bg-foreground/90 shadow-elevated',
        variant === 'secondary' &&
          'h-12 px-7 text-[15px] font-medium border-border/80 hover:bg-raised',
        variant === 'tertiary' && 'text-muted-foreground',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Button>
  );
}

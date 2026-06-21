import Image from 'next/image';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
  showMark?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'inverse' | 'brass';
};

const SIZE: Record<NonNullable<LogoProps['size']>, { box: string; mark: number; text: string }> = {
  sm: { box: 'h-7 w-7', mark: 28, text: 'text-[15px]' },
  md: { box: 'h-8 w-8', mark: 32, text: 'text-base' },
  lg: { box: 'h-10 w-10', mark: 40, text: 'text-xl' },
};

export function Logo({
  className,
  showMark = true,
  size = 'md',
  tone = 'default',
}: LogoProps) {
  const s = SIZE[size];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 font-semibold tracking-tight leading-none select-none',
        className,
      )}
    >
      {showMark && (
        <span
          aria-hidden
          className={cn(
            'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md',
            tone === 'brass'
              ? 'shadow-[0_0_20px_hsl(var(--brass)/0.12)]'
              : 'shadow-elevated ring-1 ring-inset ring-border/70',
            s.box,
          )}
        >
          <Image
            src="/logo-mark.svg"
            alt=""
            width={s.mark}
            height={s.mark}
            className="h-full w-full"
            priority={size === 'lg'}
          />
        </span>
      )}
      <span className={cn('whitespace-nowrap', s.text)}>Purechess</span>
    </span>
  );
}
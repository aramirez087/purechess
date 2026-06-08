import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
  showMark?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'inverse' | 'brass';
};

const SIZE: Record<NonNullable<LogoProps['size']>, { box: string; mark: number; text: string }> = {
  sm: { box: 'h-7 w-7', mark: 16, text: 'text-[15px]' },
  md: { box: 'h-8 w-8', mark: 18, text: 'text-base' },
  lg: { box: 'h-10 w-10', mark: 22, text: 'text-xl' },
};

export function Logo({
  className,
  showMark = true,
  size = 'md',
  tone = 'default',
}: LogoProps) {
  const s = SIZE[size];
  const markFill =
    tone === 'brass' ? 'hsl(var(--brass))' : 'currentColor';

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
            'relative inline-flex items-center justify-center rounded-md',
            'bg-raised ring-1 ring-inset ring-border/70 shadow-elevated',
            s.box,
          )}
        >
          <KnightMark size={s.mark} fill={markFill} />
        </span>
      )}
      <span className={cn('whitespace-nowrap', s.text)}>Purechess</span>
    </span>
  );
}

function KnightMark({ size, fill }: { size: number; fill: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M5.6 19.5h12.8a.9.9 0 0 0 .86-1.18l-1.08-3.62a3 3 0 0 0-1.18-1.62l-1.06-.72a.4.4 0 0 1-.16-.46l.28-1.04a.5.5 0 0 1 .28-.32l.86-.36a1 1 0 0 0 .42-1.5L16.6 7.06a4.6 4.6 0 0 0-3.78-1.96h-1.04a1 1 0 0 0-.92.6l-.36.86a.6.6 0 0 1-.96.18l-.16-.18a.6.6 0 0 0-.96.06l-.42.74a.4.4 0 0 1-.34.2.4.4 0 0 0-.34.6l.36.6a.4.4 0 0 1-.16.54l-.18.1a.5.5 0 0 0-.22.6l.18.5a.5.5 0 0 1-.06.46l-.74 1.04a2 2 0 0 0-.28 1.62l.22.92a.6.6 0 0 1-.16.56l-1.16 1.18a2 2 0 0 0-.58 1.4v1.36a.5.5 0 0 0 .5.5Z"
        fill={fill}
      />
    </svg>
  );
}

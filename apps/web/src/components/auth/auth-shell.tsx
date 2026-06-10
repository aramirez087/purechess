import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';

/**
 * Full-viewport centered shell for the auth pages. Theme-aware ambient built
 * from tokens (same approach as /play) — do not hardcode the game pages'
 * bespoke hex here.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="grain relative flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10"
      style={{
        background:
          'radial-gradient(120% 70% at 50% -10%, hsl(var(--brass) / 0.10), transparent 55%), radial-gradient(120% 120% at 50% 120%, hsl(var(--shadow-rgb, 0 0 0) / 0.45), transparent 55%), hsl(var(--background))',
      }}
    >
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center gap-4 text-center">
          <Link
            href="/"
            aria-label="PureChess home"
            className="rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo size="lg" />
          </Link>
          <div>
            <h1 className="font-display text-[clamp(1.9rem,5vw,2.4rem)] italic leading-tight tracking-[-0.01em] text-foreground">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        {children}

        <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </main>
  );
}

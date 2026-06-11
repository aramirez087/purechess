import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { HeroBoard } from '@/components/home/hero-board';

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
      tabIndex={-1}
      className="grain relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-10"
      style={{
        background:
          'radial-gradient(70% 50% at 50% -5%, hsl(var(--brass) / 0.14), transparent 62%), radial-gradient(120% 120% at 50% 120%, hsl(var(--shadow-rgb, 0 0 0) / 0.45), transparent 55%), hsl(var(--background))',
      }}
    >
      {/* Ghost of the home hero position, bottom-anchored behind the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center"
      >
        <div
          className="w-full max-w-[44rem] translate-y-[28%] opacity-[0.05]"
          style={{
            maskImage: 'linear-gradient(to top, black 30%, transparent 95%)',
            WebkitMaskImage: 'linear-gradient(to top, black 30%, transparent 95%)',
          }}
        >
          <HeroBoard />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center gap-4 text-center">
          <Link
            href="/"
            aria-label="PureChess home"
            className="rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo size="lg" tone="brass" />
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

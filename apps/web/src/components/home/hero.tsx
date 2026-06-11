import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { CtaButton } from './cta-button';
import { HeroAuthLink } from './hero-auth-link';
import { HeroBoard } from './hero-board';

const FEATURES = [
  {
    title: 'Rated matches',
    body: 'Glicko-2 ratings across bullet, blitz, and rapid.',
  },
  {
    title: 'Practice offline',
    body: 'Play against eight levels of computer, untimed.',
  },
  {
    title: 'Invite a friend',
    body: 'Send a link. Pick a time control. Start a game.',
  },
];

export function Hero() {
  return (
    <section
      aria-labelledby="hero-wordmark"
      className="grain relative overflow-hidden"
    >
      <BoardGridBackdrop />

      <div className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" aria-label="PureChess home">
            <Logo size="sm" />
          </Link>
          <HeroAuthLink />
        </div>
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center">
        <span className="animate-rise-1 inline-flex items-center gap-2 rounded-full border border-border/80 bg-raised/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm">
          <span className="h-1 w-1 rounded-full bg-brass shadow-[0_0_0_3px_hsl(var(--brass)/0.18)]" />
          Silent Tournament
        </span>

        <h1
          id="hero-wordmark"
          className="animate-rise-2 mt-6 font-display text-[clamp(3rem,7.5vw,6rem)] font-medium leading-[1.04] tracking-[-0.015em]"
        >
          The board is
          <br className="hidden sm:block" />
          <span className="relative inline-block italic">
            the product.
            <span
              aria-hidden
              className="absolute -bottom-2.5 left-1/2 -z-10 h-[3px] w-3/4 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-brass to-transparent"
            />
          </span>
        </h1>

        <p className="animate-rise-3 mt-6 max-w-xl text-balance text-base sm:text-lg text-muted-foreground">
          Purechess is a single, quiet place to play chess online. No
          puzzles, no lessons, no streams — just you, the clock, and a
          board that respects your time.
        </p>

        <div className="animate-rise-4 mt-10 flex w-full max-w-sm flex-col items-center gap-3 sm:max-w-none sm:w-auto sm:flex-row sm:justify-center">
          <CtaButton variant="primary" href="/play?mode=casual">
            Play now
            <ArrowRight
              className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </CtaButton>
          <CtaButton variant="secondary" href="/register">
            Create account
          </CtaButton>
          <CtaButton variant="tertiary" href="/analyze">
            Analyze a game
          </CtaButton>
        </div>

        <p className="mt-6 text-xs text-muted-foreground/80">
          Free to start. No ads. No tracking beyond product analytics.
        </p>

        <div className="mt-16 w-full sm:mt-20">
          <HeroBoard />
        </div>
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-x-10 gap-y-8 px-6 pb-24 sm:grid-cols-3">
        {FEATURES.map(({ title, body }, i) => (
          <article
            key={title}
            className="group relative flex flex-col gap-2.5 border-t border-border/70 pt-5"
          >
            <span
              aria-hidden
              className="absolute -top-px left-0 h-px w-10 bg-brass/80 transition-all duration-300 group-hover:w-20"
            />
            <div className="flex items-baseline">
              <span className="inline-block w-7 shrink-0 font-mono text-[11px] tracking-[0.18em] text-brass">
                0{i + 1}
              </span>
              <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
            </div>
            <p className="pl-7 text-sm text-muted-foreground leading-relaxed">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function BoardGridBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse 70% 60% at 50% 35%, black 35%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 50% 35%, black 35%, transparent 75%)',
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[60%] opacity-50"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--brass) / 0.08), transparent 60%)',
        }}
      />
    </div>
  );
}

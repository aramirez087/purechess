import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRight, Cpu, Users, Swords } from 'lucide-react';
import { CtaButton } from './cta-button';
import { Logo } from '@/components/layout/Logo';

const FEATURES = [
  {
    icon: Swords,
    title: 'Rated matches',
    body: 'Glicko-2 ratings across bullet, blitz, and rapid.',
  },
  {
    icon: Cpu,
    title: 'Practice offline',
    body: 'Play against eight levels of computer, untimed.',
  },
  {
    icon: Users,
    title: 'Invite a friend',
    body: 'Send a link. Pick a time control. Start a game.',
  },
];

export function Hero() {
  return (
    <section
      aria-labelledby="hero-wordmark"
      className="relative overflow-hidden"
    >
      <BoardGridBackdrop />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center">
        <span className="animate-rise-1 inline-flex items-center gap-2 rounded-full border border-border/80 bg-raised/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm">
          <span className="h-1 w-1 rounded-full bg-brass shadow-[0_0_0_3px_hsl(var(--brass)/0.18)]" />
          Silent Tournament
        </span>

        <h1
          id="hero-wordmark"
          className="animate-rise-2 mt-6 font-sans text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[1.02] tracking-[-0.04em]"
        >
          The board is
          <br className="hidden sm:block" />
          <span className="relative inline-block">
            the product.
            <span
              aria-hidden
              className="absolute -bottom-1 left-1/2 h-[3px] w-3/4 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-brass to-transparent"
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
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
          </CtaButton>
          <CtaButton variant="secondary" href="/register">
            Create account
          </CtaButton>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex">
                  <CtaButton variant="tertiary" disabled>
                    Analyze a game
                  </CtaButton>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <p className="mt-6 text-xs text-muted-foreground/80">
          Free to start. No ads. No tracking beyond product analytics.
        </p>
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-3 px-6 pb-24 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }, i) => (
          <article
            key={title}
            className={`group relative flex flex-col gap-3 rounded-lg border border-border/70 bg-surface/60 p-5 shadow-elevated backdrop-blur-sm transition-colors hover:border-brass/40 animate-rise-${i + 2}`}
          >
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-raised ring-1 ring-inset ring-border text-brass">
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
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
        className="absolute inset-0 opacity-[0.06] dark:opacity-[0.08]"
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

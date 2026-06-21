import Link from 'next/link';
import { Cpu, Microscope, Puzzle, Target } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { InstantComputerButton } from '@/components/play/instant-computer-button';
import { HeroAuthLink } from './hero-auth-link';
import { HeroBoard } from './hero-board';
import { HeroHeading } from './hero-heading';

const FEATURES = [
  {
    title: 'One-click play',
    body: 'Start a computer game immediately, then customize only when you need to.',
  },
  {
    title: 'Tactics training',
    body: 'Daily puzzles, theme drills, rush, and spaced-repetition review.',
  },
  {
    title: 'Rated matches',
    body: 'Glicko-2 ratings across bullet, blitz, and rapid.',
  },
  {
    title: 'Invite a friend',
    body: 'Send a link. Pick a time control. Start a game.',
  },
];

const ACTION_CLASS =
  'group flex min-h-[5.25rem] w-full items-center gap-3 rounded-[10px] border border-border/75 bg-surface/70 px-4 py-3 text-left shadow-elevated backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brass/50 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const PRIMARY_ACTION_CLASS =
  'border-brass/60 bg-brass-soft/25 hover:bg-brass-soft/35';

export function Hero() {
  return (
    <section aria-labelledby="hero-wordmark" className="grain relative overflow-hidden">
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

        <HeroHeading />

        {/* No entrance animation: this subtitle is the largest above-the-fold
            text and the page's LCP element under throttled load. animate-rise-*
            is fadeInUp (opacity:0 backwards-fill), which defers its contentful
            paint and pushes LCP out to ~5s in Lighthouse. Static = LCP at FCP.
            (S07 — Lighthouse gate; same reason HeroHeading is static.) */}
        <p className="mt-6 max-w-xl text-balance text-base sm:text-lg text-muted-foreground">
          Purechess is a single, quiet place to play chess online — and get sharper when
          you&apos;re between games. One click to play, one board that respects your time.
        </p>

        <div className="animate-rise-4 mt-10 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-2">
          <InstantComputerButton
            analyticsSource="home_hero"
            className={`${ACTION_CLASS} ${PRIMARY_ACTION_CLASS} text-foreground`}
          >
            <ActionContent icon={Cpu} title="Play computer" body="Default Stockfish game" />
          </InstantComputerButton>
          <ActionLink href="/puzzles" icon={Puzzle} title="Daily puzzle" body="Start solving" />
          <ActionLink href="/train" icon={Target} title="Train" body="Puzzles, openings, endgames" />
          <ActionLink href="/analyze" icon={Microscope} title="Analyze" body="Paste PGN or FEN" />
        </div>

        <p className="mt-5 text-xs text-muted-foreground/80">
          Pick a mode and go. Settings are available when you need them.
        </p>

        <div className="mt-16 w-full sm:mt-20">
          <HeroBoard />
        </div>
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-x-10 gap-y-8 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
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

type ActionIcon = typeof Cpu;

function ActionLink({
  href,
  icon,
  title,
  body,
  className,
}: {
  href: string;
  icon: ActionIcon;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <Link href={href} aria-label={title} className={`${ACTION_CLASS} ${className ?? ''}`}>
      <ActionContent icon={icon} title={title} body={body} />
    </Link>
  );
}

function ActionContent({
  icon: Icon,
  title,
  body,
}: {
  icon: ActionIcon;
  title: string;
  body: string;
}) {
  return (
    <>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-brass/15 text-brass-text ring-1 ring-inset ring-brass/25 transition-colors group-hover:bg-brass/20">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold tracking-tight">{title}</span>
        <span className="action-copy mt-0.5 block text-sm text-muted-foreground">
          {body}
        </span>
      </span>
    </>
  );
}

function BoardGridBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 35%, black 35%, transparent 75%)',
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

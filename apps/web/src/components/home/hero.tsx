import Link from 'next/link';
import { Cpu, Microscope, Puzzle, Target } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { InstantComputerButton } from '@/components/play/instant-computer-button';
import { HeroAuthLink } from './hero-auth-link';
import { HeroBoard } from './hero-board';
import { HeroHeading } from './hero-heading';

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

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pt-20 pb-16 sm:pt-24 sm:pb-20 text-center">
        <HeroHeading />

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

        <div className="mt-14 w-full sm:mt-16">
          <HeroBoard />
        </div>
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
'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Cpu, Crown, Users, Swords } from 'lucide-react';
import { InviteCreate } from '@/components/play/invite-create';
import { ComputerGameSetup } from '@/components/play/computer-game-setup';
import { posthog } from '@/lib/posthog';
import { cn } from '@/lib/utils';

const AMBIENT =
  'radial-gradient(125% 80% at 50% -10%, hsl(var(--brass) / 0.10), transparent 55%), radial-gradient(120% 120% at 50% 115%, hsl(var(--shadow-rgb) / 0.45), transparent 55%), hsl(var(--background))';

/**
 * Full-viewport, vertically-centered play shell with a theme-aware ambient
 * background + grain. Owns the single `#main-content` landmark for this route.
 */
function PlayShell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <main
      id="main-content"
      className="grain relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-12 sm:px-6"
      style={{ background: AMBIENT }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'linear-gradient(45deg, hsl(var(--foreground) / 0.022) 25%, transparent 25%, transparent 75%, hsl(var(--foreground) / 0.022) 75%), linear-gradient(45deg, hsl(var(--foreground) / 0.022) 25%, transparent 25%, transparent 75%, hsl(var(--foreground) / 0.022) 75%)',
          backgroundSize: '128px 128px',
          backgroundPosition: '0 0, 64px 64px',
          maskImage: 'radial-gradient(ellipse 78% 68% at 50% 44%, #000 5%, transparent 72%)',
          WebkitMaskImage: 'radial-gradient(ellipse 78% 68% at 50% 44%, #000 5%, transparent 72%)',
        }}
      />
      <div className={cn('relative z-10 w-full', narrow ? 'max-w-lg' : 'max-w-5xl')}>{children}</div>
    </main>
  );
}

type PlayMode = 'select' | 'friend' | 'computer';

const MODES: Array<{
  id: Exclude<PlayMode, 'select'>;
  title: string;
  description: string;
  meta: string;
  icon: typeof Cpu;
  recommended?: boolean;
}> = [
  {
    id: 'computer',
    title: 'Play vs Computer',
    description: 'Untimed games against eight levels of Stockfish. Practice openings or play endgames on demand.',
    meta: 'Untimed · 8 levels',
    icon: Cpu,
  },
  {
    id: 'friend',
    title: 'Play a Friend',
    description: 'Generate a link, share it, choose your time control. Game starts when they accept.',
    meta: 'Bullet · Blitz · Rapid',
    icon: Users,
    recommended: true,
  },
];

export function PlayPageClient() {
  const router = useRouter();
  const [mode, setMode] = useState<PlayMode>('select');

  if (mode === 'computer') {
    return (
      <PlayShell narrow>
        <div className="animate-rise">
          <button
            onClick={() => setMode('select')}
            className="mb-6 inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          <ComputerGameSetup
            onCancel={() => setMode('select')}
            onGameCreated={(gameId) => router.push(`/computer-game/${gameId}`)}
          />
        </div>
      </PlayShell>
    );
  }

  if (mode === 'friend') {
    return (
      <PlayShell narrow>
        <div className="animate-rise">
          <button
            onClick={() => setMode('select')}
            className="mb-6 inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          <InviteCreate onCancel={() => setMode('select')} />
        </div>
      </PlayShell>
    );
  }

  return (
    <PlayShell>
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <Link
          href="/"
          className="group mb-8 inline-flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="grid h-7 w-7 place-items-center rounded-md bg-brass/10 text-brass ring-1 ring-inset ring-brass/30">
            <Crown className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/85 transition-colors group-hover:text-foreground">
            PureChess
          </span>
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-raised/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <Swords className="h-3 w-3 text-brass" />
          Choose a mode
        </span>
        <h1 className="mt-5 font-display text-4xl sm:text-5xl font-medium tracking-[-0.01em]">
          How do you want to play?
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground">
          Pick a starting point. You can change your mind before the first move.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {MODES.map(({ id, title, description, meta, icon: Icon, recommended }, i) => (
          <button
            key={id}
            onClick={() => {
              posthog.capture('play_clicked', { mode: id });
              setMode(id);
            }}
            className={cn(
              'group relative flex min-h-[15rem] flex-col items-start gap-5 rounded-2xl border bg-surface/70 p-7 text-left shadow-elevated transition-all sm:p-8',
              'hover:-translate-y-0.5 hover:border-brass/50 hover:shadow-brass-glow',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'animate-rise',
              i === 1 ? 'animate-rise-2' : 'animate-rise-1',
              recommended
                ? 'border-brass/40 bg-gradient-to-br from-surface via-surface to-brass/[0.04]'
                : 'border-border/70',
            )}
          >
            {recommended && (
              <span className="absolute -top-2 right-5 inline-flex items-center gap-1 rounded-full border border-brass/40 bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-brass">
                <span className="h-1 w-1 rounded-full bg-brass" />
                Suggested
              </span>
            )}

            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'inline-flex h-12 w-12 items-center justify-center rounded-lg ring-1 ring-inset',
                  recommended
                    ? 'bg-brass/10 text-brass ring-brass/30'
                    : 'bg-raised text-foreground ring-border',
                )}
              >
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            </div>
            <p className="text-[15px] text-muted-foreground leading-relaxed">{description}</p>
            <div className="mt-auto flex w-full items-center justify-between pt-3">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
                {meta}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground transition-transform group-hover:translate-x-0.5">
                Continue
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </PlayShell>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Cpu, Users, Swords } from 'lucide-react';
import { InviteCreate } from '@/components/play/invite-create';
import { ComputerGameSetup } from '@/components/play/computer-game-setup';
import { posthog } from '@/lib/posthog';
import { cn } from '@/lib/utils';

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
      <div className="flex min-h-[calc(100dvh-3.5rem)] items-start justify-center px-4 py-12 sm:py-20">
        <div className="w-full max-w-lg animate-rise">
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
      </div>
    );
  }

  if (mode === 'friend') {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] items-start justify-center px-4 py-12 sm:py-20">
        <div className="w-full max-w-lg animate-rise">
          <button
            onClick={() => setMode('select')}
            className="mb-6 inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          <InviteCreate onCancel={() => setMode('select')} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-raised/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <Swords className="h-3 w-3 text-brass" />
          Choose a mode
        </span>
        <h1 className="mt-5 font-sans text-3xl sm:text-4xl font-semibold tracking-[-0.025em]">
          How do you want to play?
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground">
          Pick a starting point. You can change your mind before the first move.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {MODES.map(({ id, title, description, meta, icon: Icon, recommended }, i) => (
          <button
            key={id}
            onClick={() => {
              posthog.capture('play_clicked', { mode: id });
              setMode(id);
            }}
            className={cn(
              'group relative flex flex-col items-start gap-4 rounded-xl border bg-surface/70 p-6 text-left shadow-elevated transition-all',
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
                  'inline-flex h-10 w-10 items-center justify-center rounded-md ring-1 ring-inset',
                  recommended
                    ? 'bg-brass/10 text-brass ring-brass/30'
                    : 'bg-raised text-foreground ring-border',
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
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
    </div>
  );
}

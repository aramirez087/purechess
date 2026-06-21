'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Cpu,
  Crown,
  Settings2,
  Users,
  Zap,
} from 'lucide-react';
import { InviteCreate } from '@/components/play/invite-create';
import { ComputerGameSetup } from '@/components/play/computer-game-setup';
import { InstantComputerButton } from '@/components/play/instant-computer-button';
import { QuickMatchSetup } from '@/components/play/quick-match-setup';
import { HeroBoard } from '@/components/home/hero-board';
import { Button } from '@/components/ui/button';
import { posthog } from '@/lib/posthog';
import { formatPlayPrefsLabel } from '@/lib/play-preferences';
import { useSettingsStore } from '@/stores/settings-store';
import { cn } from '@/lib/utils';

const AMBIENT =
  'radial-gradient(125% 80% at 50% -10%, hsl(var(--brass) / 0.10), transparent 55%), radial-gradient(120% 120% at 50% 115%, hsl(var(--shadow-rgb) / 0.45), transparent 55%), radial-gradient(60% 35% at 50% 100%, hsl(var(--brass) / 0.05), transparent 70%), hsl(var(--background))';

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
            'linear-gradient(45deg, hsl(var(--foreground) / 0.035) 25%, transparent 25%, transparent 75%, hsl(var(--foreground) / 0.035) 75%), linear-gradient(45deg, hsl(var(--foreground) / 0.035) 25%, transparent 25%, transparent 75%, hsl(var(--foreground) / 0.035) 75%)',
          backgroundSize: '128px 128px',
          backgroundPosition: '0 0, 64px 64px',
          maskImage: 'radial-gradient(ellipse 90% 85% at 50% 40%, #000 10%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 85% at 50% 40%, #000 10%, transparent 80%)',
        }}
      />
      <div className={cn('relative z-10 w-full', narrow ? 'max-w-lg' : 'max-w-5xl')}>{children}</div>
    </main>
  );
}

type PlayMode = 'home' | 'friend' | 'computer' | 'quick';

function resolveInitialMode(mode?: string): PlayMode {
  if (mode === 'friend' || mode === 'invite') return 'friend';
  if (mode === 'computer' || mode === 'casual') return 'computer';
  if (mode === 'quick' || mode === 'rated') return 'quick';
  return 'home';
}

const ALT_MODES: Array<{
  id: Exclude<PlayMode, 'home' | 'quick' | 'computer'>;
  title: string;
  description: string;
  meta: string;
  icon: typeof Cpu;
}> = [
  {
    id: 'friend',
    title: 'Play a Friend',
    description: 'Generate a link, share it, choose your time control.',
    meta: 'Bullet · Blitz · Rapid',
    icon: Users,
  },
];

type PlayPageClientProps = {
  initialMode?: string;
};

export function PlayPageClient({ initialMode }: PlayPageClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<PlayMode>(() => resolveInitialMode(initialMode));
  const playPreferences = useSettingsStore((s) => s.playPreferences);
  const prefsLabel = formatPlayPrefsLabel(playPreferences);

  if (mode === 'computer') {
    return (
      <PlayShell narrow>
        <div className="animate-rise">
          <button
            onClick={() => setMode('home')}
            className="mb-6 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back
          </button>
          <ComputerGameSetup
            onCancel={() => setMode('home')}
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
            onClick={() => setMode('home')}
            className="mb-6 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back
          </button>
          <InviteCreate onCancel={() => setMode('home')} />
        </div>
      </PlayShell>
    );
  }

  if (mode === 'quick') {
    return (
      <PlayShell narrow>
        <div className="animate-rise">
          <button
            onClick={() => setMode('home')}
            className="mb-6 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back
          </button>
          <QuickMatchSetup loginReturn="/play" />
        </div>
      </PlayShell>
    );
  }

  return (
    <PlayShell>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-20 -z-10 mx-auto w-[30rem] max-w-full opacity-[0.05]"
        style={{
          maskImage: 'radial-gradient(ellipse 70% 65% at 50% 40%, #000 25%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 65% at 50% 40%, #000 25%, transparent 75%)',
        }}
      >
        <HeroBoard />
      </div>

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
        <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-[-0.01em]">
          Ready to <span className="italic">play?</span>
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground">
          One click to find an opponent. Customize time control only when you want to.
        </p>
      </div>

      {/* Primary 1-click paths */}
      <div className="mx-auto mt-10 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border border-brass/40 bg-gradient-to-br from-surface via-surface to-brass/[0.06]',
            'p-7 shadow-elevated backdrop-blur-sm',
          )}
        >
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brass/10 text-brass ring-1 ring-inset ring-brass/30">
              <Cpu className="h-6 w-6" />
            </span>
            <div className="min-w-0 text-left">
              <h2 className="text-xl font-semibold tracking-tight">Computer</h2>
              <p className="mt-1 text-sm text-muted-foreground">Untimed · Level 4 · Random side</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2.5">
            <InstantComputerButton
              analyticsSource="play_hub"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 text-[15px] font-medium text-background shadow-elevated transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none"
            >
              Start computer
            </InstantComputerButton>
            <Button
              variant="outline"
              className="h-10 border-border/80 px-5"
              onClick={() => {
                posthog.capture('play_clicked', { mode: 'computer', instant: false });
                setMode('computer');
              }}
            >
              <Settings2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Customize
            </Button>
          </div>
        </div>

        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border border-border/70 bg-surface/80',
            'p-7 shadow-elevated backdrop-blur-sm',
          )}
        >
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-raised text-brass ring-1 ring-inset ring-border">
              <Zap className="h-6 w-6" />
            </span>
            <div className="min-w-0 text-left">
              <h2 className="text-xl font-semibold tracking-tight">Quick Match</h2>
              <p className="mt-1 text-sm text-muted-foreground">{prefsLabel}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              asChild
              className="h-12 w-full bg-foreground text-[15px] font-medium text-background shadow-elevated hover:bg-foreground/90"
            >
              <Link
                href="/play/quick"
                onClick={() => posthog.capture('play_clicked', { mode: 'quick', instant: true })}
              >
                Find opponent
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-10 border-border/80 px-5"
              onClick={() => {
                posthog.capture('play_clicked', { mode: 'quick', instant: false });
                setMode('quick');
              }}
            >
              <Settings2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Change time
            </Button>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-8 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        More ways to play
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {ALT_MODES.map(({ id, title, description, meta, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              posthog.capture('play_clicked', { mode: id });
              setMode(id);
            }}
            className={cn(
              'group flex flex-col items-start gap-4 rounded-2xl border border-border/70 bg-surface/70 p-6 text-left',
              'shadow-elevated backdrop-blur-sm transition-all duration-200',
              'hover:-translate-y-0.5 hover:border-brass/50 hover:shadow-brass-glow',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-raised text-brass ring-1 ring-inset ring-border">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            <div className="mt-auto flex w-full items-center justify-between border-t border-border/50 pt-3">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{meta}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brass" />
            </div>
          </button>
        ))}
      </div>

      <div
        aria-hidden="true"
        className="mx-auto mt-16 h-px w-28 bg-gradient-to-r from-transparent via-brass/40 to-transparent"
      />
    </PlayShell>
  );
}

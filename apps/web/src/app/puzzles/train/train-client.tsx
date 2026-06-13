'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import type { PuzzleThemeDto, PuzzleThemeStatDto } from '@purechess/shared';
import { Button } from '@/components/ui/button';
import { ThemeTile } from '@/components/puzzle/theme-tile';
import { TrainingSession } from '@/components/puzzle/training-session';

/**
 * Theme trainer entry. Phase 1 lets the user pick a theme (weakest surfaced
 * first); phase 2 runs the reusable {@link TrainingSession} drill. A `?theme=`
 * deep-link (used by S11/S12 links) jumps straight into phase 2. Signed-out
 * users browse the grid read-only with a sign-in prompt — the daily puzzle is
 * the no-auth entry point, so this screen never gates it.
 */

export interface TrainClientProps {
  themes: PuzzleThemeDto[];
  stats: PuzzleThemeStatDto[];
  signedIn: boolean;
  initialTheme: string | null;
}

const MIN_ATTEMPTS_FOR_WEAKEST = 5;
const WEAKEST_COUNT = 3;

/** Top-N themes by accuracy ASC with at least `min` attempts (the drill signal). */
export function selectWeakestThemes(
  stats: PuzzleThemeStatDto[],
  min = MIN_ATTEMPTS_FOR_WEAKEST,
  count = WEAKEST_COUNT,
): PuzzleThemeStatDto[] {
  return stats
    .filter((s) => s.attempts >= min && typeof s.accuracy === 'number')
    .sort((a, b) => (a.accuracy! - b.accuracy!) || b.attempts - a.attempts)
    .slice(0, count);
}

export function TrainClient({ themes, stats, signedIn, initialTheme }: TrainClientProps) {
  const router = useRouter();
  const [activeTheme, setActiveTheme] = useState<string | null>(initialTheme);
  const [training, setTraining] = useState<boolean>(Boolean(initialTheme));

  const statBySlug = useMemo(() => {
    const map = new Map<string, PuzzleThemeStatDto>();
    for (const s of stats) map.set(s.slug, s);
    return map;
  }, [stats]);

  const weakest = useMemo(() => selectWeakestThemes(stats), [stats]);
  const weakestSlugs = useMemo(() => new Set(weakest.map((w) => w.slug)), [weakest]);

  const startDrill = (slug: string | null) => {
    setActiveTheme(slug);
    setTraining(true);
  };

  const backToSelection = () => {
    setTraining(false);
    // Drop the deep-link param so refresh returns to selection.
    router.replace('/puzzles/train');
  };

  if (training) {
    return (
      <TrainingSession
        theme={activeTheme}
        source="theme"
        onBack={backToSelection}
        onChangeTheme={backToSelection}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:py-10">
      <header className="flex flex-col gap-2 border-b border-border/60 pb-5">
        <h1 className="font-display text-3xl italic tracking-[-0.01em] text-foreground sm:text-4xl">
          Train by theme
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Drill tactics calibrated to your rating. Pick a theme, solve a stream of
          puzzles, and watch your accuracy move.
        </p>
      </header>

      {!signedIn && (
        <div className="flex flex-col items-start gap-3 rounded-[10px] border border-brass/40 bg-brass-soft/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            <span className="font-medium">Sign in to track accuracy</span> and drill your
            weakest themes. The{' '}
            <Link href="/puzzles" className="text-brass underline-offset-2 hover:underline">
              daily puzzle
            </Link>{' '}
            needs no account.
          </p>
          <Button asChild className="h-9 shrink-0 bg-foreground font-semibold text-background hover:bg-foreground/90">
            <Link href="/login?return=/puzzles/train">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </Link>
          </Button>
        </div>
      )}

      {signedIn && weakest.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Your weakest themes
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {weakest.map((s) => (
              <ThemeTile
                key={s.slug}
                slug={s.slug}
                label={s.label}
                puzzleCount={themes.find((t) => t.slug === s.slug)?.puzzleCount}
                attempts={s.attempts}
                accuracy={s.accuracy}
                weakest
                onSelect={startDrill}
              />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          All themes
        </h2>
        {themes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No themes available yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((t) => {
              const stat = statBySlug.get(t.slug);
              return (
                <ThemeTile
                  key={t.slug}
                  slug={t.slug}
                  label={t.label}
                  puzzleCount={t.puzzleCount}
                  attempts={signedIn ? stat?.attempts ?? 0 : 0}
                  accuracy={signedIn ? stat?.accuracy : undefined}
                  weakest={weakestSlugs.has(t.slug)}
                  disabled={!signedIn}
                  onSelect={startDrill}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

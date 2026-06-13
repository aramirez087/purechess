'use client';

import Link from 'next/link';
import { LogIn, Target } from 'lucide-react';
import type { PuzzleHistoryDto, PuzzleThemeStatDto } from '@purechess/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PuzzleRatingChart } from '@/components/puzzle/puzzle-rating-chart';
import { ThemeAccuracyTable } from '@/components/puzzle/theme-accuracy-table';
import { accuracyBand, humanizeTheme } from '@/components/puzzle/theme-tile';

/**
 * Puzzle stats surface. Top: the puzzle rating (big), an accuracy summary, and a
 * primary "Practice [weakest theme]" CTA that deep-links into the matching drill
 * (`/puzzles/train?theme=`). Then the rating curve, then the weakest-first theme
 * table. Signed-out users get a sign-in prompt (stats are entirely personal).
 */

export interface PuzzleStatsClientProps {
  signedIn: boolean;
  history: PuzzleHistoryDto | null;
  stats: PuzzleThemeStatDto[];
}

export function PuzzleStatsClient({ signedIn, history, stats }: PuzzleStatsClientProps) {
  if (!signedIn) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:py-10">
        <Header />
        <div
          data-testid="stats-signin-prompt"
          className="flex flex-col items-start gap-3 rounded-[10px] border border-brass/40 bg-brass-soft/20 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-foreground">
            <span className="font-medium">Sign in to see your puzzle stats</span> — your rating
            curve and accuracy by theme. The{' '}
            <Link href="/puzzles" className="text-brass underline-offset-2 hover:underline">
              daily puzzle
            </Link>{' '}
            needs no account.
          </p>
          <Button
            asChild
            className="h-9 shrink-0 bg-foreground font-semibold text-background hover:bg-foreground/90"
          >
            <Link href="/login?return=/puzzles/stats">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const summary = history?.summary;
  const ratingHistory = history?.ratingHistory ?? [];
  const weakest = summary?.weakestTheme ?? null;
  const accuracyPct =
    summary && typeof summary.accuracy === 'number' ? Math.round(summary.accuracy * 100) : null;
  const accBand = accuracyPct !== null ? accuracyBand(accuracyPct / 100) : null;
  const weakestName = weakest ? weakest.label ?? humanizeTheme(weakest.slug) : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:py-10">
      <Header />

      {/* Headline: rating + accuracy + practice CTA */}
      <section className="grid gap-4 rounded-[12px] border border-border/70 bg-surface/60 p-5 shadow-elevated sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Puzzle rating
          </span>
          <span
            data-testid="puzzle-rating-value"
            className="font-mono text-4xl font-semibold leading-none tabular-nums text-foreground sm:text-5xl"
          >
            {summary?.puzzleRating ?? 1500}
          </span>
        </div>

        <div className="flex flex-col gap-1 sm:border-l sm:border-border/60 sm:pl-6">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Accuracy
          </span>
          {accuracyPct !== null && accBand !== null ? (
            <span className={cn('font-mono text-2xl font-semibold tabular-nums', `acc-${accBand}`)}>
              {accuracyPct}%
            </span>
          ) : (
            <span className="font-mono text-2xl font-semibold tabular-nums text-muted-foreground/70">
              —
            </span>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {summary?.solved ?? 0}/{summary?.attempted ?? 0} solved
          </span>
        </div>

        {weakest && weakestName ? (
          <Button
            asChild
            className="h-11 shrink-0 gap-2 bg-foreground px-5 font-semibold text-background hover:bg-foreground/90"
          >
            <Link href={`/puzzles/train?theme=${encodeURIComponent(weakest.slug)}`}>
              <Target className="h-4 w-4" aria-hidden="true" />
              Practice {weakestName}
            </Link>
          </Button>
        ) : (
          <Button
            asChild
            variant="outline"
            className="h-11 shrink-0 gap-2 px-5 font-semibold"
          >
            <Link href="/puzzles/train">
              <Target className="h-4 w-4" aria-hidden="true" />
              Train by theme
            </Link>
          </Button>
        )}
      </section>

      {/* Rating curve */}
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Rating over time
        </h2>
        <div className="rounded-[12px] border border-border/70 bg-surface/60 p-5 shadow-elevated">
          <PuzzleRatingChart history={ratingHistory} />
        </div>
      </section>

      {/* Accuracy by theme, weakest first */}
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Accuracy by theme
        </h2>
        <ThemeAccuracyTable stats={stats} />
      </section>
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-2 border-b border-border/60 pb-5">
      <h1 className="font-display text-3xl italic tracking-[-0.01em] text-foreground sm:text-4xl">
        Your puzzle stats
      </h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Watch your rating climb and find the themes holding you back. Practice your weakest theme
        in one click.
      </p>
    </header>
  );
}

'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Castle,
  Crosshair,
  Lightbulb,
  LogIn,
  RefreshCw,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { InsightDto, TrainingPlanDto, TrainingStreakDto } from '@purechess/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StreakBanner } from '@/components/training/streak-banner';
import { DailyPlan } from '@/components/training/daily-plan';

/**
 * The training hub — the front door to "get better today". For a signed-in user
 * it shows: the streak banner, a one-line Focus drawn from the top insight, the
 * concrete ~10-minute daily plan, and entry tiles to every mode (with the review
 * due badge). Signed out → the daily puzzle plus a sign-in-to-track pitch.
 *
 * Everything here is server-computed and passed in; this is presentational.
 */

export interface TrainClientProps {
  signedIn: boolean;
  plan: TrainingPlanDto | null;
  streak: TrainingStreakDto | null;
  insight: InsightDto | null;
}

interface Mode {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const MODES: Mode[] = [
  { href: '/puzzles', label: 'Daily puzzle', description: "Today's one position", icon: Sun },
  { href: '/puzzles/train', label: 'Train by theme', description: 'Tactics at your level', icon: Crosshair },
  { href: '/puzzles/rush', label: 'Puzzle Rush', description: 'Solve against the clock', icon: Sparkles },
  { href: '/puzzles/review', label: 'Review', description: 'Puzzles you missed', icon: RefreshCw },
  { href: '/openings', label: 'Openings', description: 'Drill your repertoire', icon: Castle },
  { href: '/endgames', label: 'Endgames', description: 'Must-know technique', icon: Target },
  { href: '/puzzles/stats', label: 'Stats', description: 'Your rating, moving', icon: BarChart3 },
  { href: '/train/insights', label: 'Insights', description: 'What to work on', icon: Lightbulb },
];

export function TrainClient({ signedIn, plan, streak, insight }: TrainClientProps) {
  if (!signedIn) {
    return <SignedOut />;
  }

  const dueCount = countReviewDue(plan);
  const focus = insight?.weaknesses?.[0] ?? null;

  return (
    <Shell>
      <Header />

      {streak ? <StreakBanner streak={streak} /> : null}

      {focus ? (
        <Link
          href={focus.actionHref ?? '/train/insights'}
          data-testid="focus-line"
          className="group flex items-center justify-between gap-4 rounded-[10px] border border-brass/40 bg-brass-soft/15 px-4 py-3 transition-colors hover:bg-brass-soft/25"
        >
          <p className="min-w-0 text-sm text-foreground">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass-text">
              Focus
            </span>{' '}
            <span className="font-medium">{focus.title ?? focus.label}</span>
            {focus.evidence ? (
              <span className="text-muted-foreground"> — {focus.evidence}</span>
            ) : null}
          </p>
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brass-text">
            Fix this
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      ) : null}

      {plan ? <DailyPlan plan={plan} /> : null}

      <ModeGrid dueCount={dueCount} />
    </Shell>
  );
}

/** The review item's remaining count, surfaced as the Review tile badge. */
function countReviewDue(plan: TrainingPlanDto | null): number {
  const review = plan?.items.find((i) => i.kind === 'review');
  if (!review) return 0;
  const target = review.target ?? review.count ?? 0;
  const done = review.doneToday ?? 0;
  return Math.max(0, target - done);
}

function ModeGrid({ dueCount }: { dueCount: number }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        All modes
      </h2>
      <div data-testid="mode-grid" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {MODES.map((mode) => (
          <ModeTile
            key={mode.href}
            mode={mode}
            badge={mode.href === '/puzzles/review' && dueCount > 0 ? dueCount : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function ModeTile({ mode, badge }: { mode: Mode; badge?: number }) {
  const Icon = mode.icon;
  return (
    <Link
      href={mode.href}
      data-testid="mode-tile"
      data-mode={mode.label}
      className="group relative flex flex-col gap-2 rounded-[10px] border border-border/70 bg-surface/60 p-4 transition-colors hover:border-brass/50 hover:bg-surface"
    >
      {badge != null ? (
        <span
          data-testid="review-due-badge"
          className="absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-brass px-1.5 font-mono text-[11px] font-semibold text-brass-foreground"
        >
          {badge}
        </span>
      ) : null}
      <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-muted text-muted-foreground transition-colors group-hover:bg-brass/15 group-hover:text-brass-text">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="font-medium text-foreground">{mode.label}</span>
      <span className="text-xs text-muted-foreground">{mode.description}</span>
    </Link>
  );
}

function SignedOut() {
  return (
    <Shell>
      <Header />
      <div
        data-testid="train-signin"
        className="flex flex-col items-start gap-4 rounded-[12px] border border-brass/40 bg-brass-soft/20 p-6 shadow-elevated"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-brass/15 text-brass-text">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-medium text-foreground">Sign in to start a streak</h2>
            <p className="text-sm text-muted-foreground">
              Track a daily plan aimed at your weakest area, build a streak, and watch your rating
              move.
            </p>
          </div>
        </div>
        <Button
          asChild
          className="h-9 bg-foreground font-semibold text-background hover:bg-foreground/90"
        >
          <Link href="/login?return=/train">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Sign in
          </Link>
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Try it now
        </h2>
        <Link
          href="/puzzles"
          data-testid="signed-out-daily"
          className="group flex items-center justify-between gap-4 rounded-[10px] border border-border/70 bg-surface/60 p-5 transition-colors hover:border-brass/50"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-brass/15 text-brass-text">
              <Sun className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <span className="font-medium text-foreground">Solve the daily puzzle</span>
              <p className="text-sm text-muted-foreground">No account needed to start.</p>
            </div>
          </div>
          <ArrowRight
            className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:py-10')}>
      {children}
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-2 border-b border-border/60 pb-5">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Improve
      </span>
      <h1 className="font-display text-3xl italic tracking-[-0.01em] text-foreground sm:text-4xl">
        Train
      </h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        One place to get better — a short daily plan aimed at your weakest area, a streak that
        rewards showing up.
      </p>
    </header>
  );
}

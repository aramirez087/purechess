'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Castle,
  Clock,
  Crosshair,
  LogIn,
  Swords,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { InsightDto, WeaknessDto, WeaknessKind } from '@purechess/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { insightActionClicked, insightViewed } from '@/lib/analytics/training-events';

/**
 * The insights surface — "what should I work on?" answered with evidence.
 *
 * A ranked card list: each card carries a plain-language title, the evidence
 * (the numbers behind it), and a primary "Fix this" button deep-linking to the
 * drill that addresses it. The top card is highlighted as the headline. Signed
 * out → sign-in prompt; signed in with too little history → a low-data state
 * that points at the trainers so the user can build up signal.
 */

export interface InsightsClientProps {
  signedIn: boolean;
  insight: InsightDto | null;
}

/** Icon + accent per weakness kind. */
const KIND_META: Record<WeaknessKind, { icon: LucideIcon; verb: string }> = {
  theme: { icon: Crosshair, verb: 'Drill it' },
  'game-mistake': { icon: Swords, verb: 'Drill it' },
  opening: { icon: Castle, verb: 'Train the line' },
  endgame: { icon: Target, verb: 'Practice it' },
  time: { icon: Clock, verb: 'Play a game' },
};

function kindMeta(kind?: WeaknessKind) {
  return (kind && KIND_META[kind]) ?? { icon: TrendingUp, verb: 'Fix this' };
}

export function InsightsClient({ signedIn, insight }: InsightsClientProps) {
  if (!signedIn) {
    return (
      <Shell>
        <Header />
        <div
          data-testid="insights-signin-prompt"
          className="flex flex-col items-start gap-3 rounded-[10px] border border-brass/40 bg-brass-soft/20 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-foreground">
            <span className="font-medium">Sign in to see what to work on</span> — we mine your
            puzzles, games, openings and endgames into a ranked list of weaknesses, each linked to
            the drill that fixes it.
          </p>
          <Button
            asChild
            className="h-9 shrink-0 bg-foreground font-semibold text-background hover:bg-foreground/90"
          >
            <Link href="/login?return=/train/insights">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </Link>
          </Button>
        </div>
      </Shell>
    );
  }

  const weaknesses = insight?.weaknesses ?? [];

  if (weaknesses.length === 0) {
    return (
      <Shell>
        <Header />
        <div
          data-testid="insights-empty"
          className="flex flex-col items-start gap-4 rounded-[12px] border border-border/70 bg-surface/60 p-6 shadow-elevated"
        >
          <p className="max-w-xl text-sm text-muted-foreground">
            Play and solve a bit more — we need a little history before we can spot patterns. Once
            you have some puzzles and games on record, the weaknesses costing you the most rating
            show up here.
          </p>
          <div className="flex flex-wrap gap-2">
            <PillLink href="/puzzles/train" label="Train tactics" />
            <PillLink href="/openings" label="Drill openings" />
            <PillLink href="/endgames" label="Practice endgames" />
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header />
      <ol className="flex flex-col gap-3" data-testid="insights-list">
        {weaknesses.map((w, i) => (
          <WeaknessCard key={cardKey(w, i)} weakness={w} featured={i === 0} rank={i + 1} />
        ))}
      </ol>
    </Shell>
  );
}

function cardKey(w: WeaknessDto, i: number): string {
  return `${w.kind ?? w.area}:${w.slug ?? w.label}:${i}`;
}

function WeaknessCard({
  weakness,
  featured,
  rank,
}: {
  weakness: WeaknessDto;
  featured: boolean;
  rank: number;
}) {
  const meta = kindMeta(weakness.kind);
  const Icon = meta.icon;
  const title = weakness.title ?? weakness.label;
  const href = weakness.actionHref ?? '/train';
  const kind = weakness.kind ?? weakness.area;

  // Analytics: the insight card was rendered (viewed).
  useEffect(() => {
    insightViewed(kind);
  }, [kind]);

  return (
    <li
      data-testid="insight-card"
      data-kind={weakness.kind ?? weakness.area}
      className={cn(
        'flex flex-col gap-4 rounded-[12px] border p-5 shadow-elevated transition-colors sm:flex-row sm:items-center sm:justify-between',
        featured
          ? 'border-brass/50 bg-brass-soft/15'
          : 'border-border/70 bg-surface/60',
      )}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]',
            featured ? 'bg-brass/15 text-brass-text' : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {featured ? 'Top priority' : `#${rank}`}
            </span>
          </div>
          <h2 className="font-medium leading-snug text-foreground">{title}</h2>
          {weakness.evidence ? (
            <p data-testid="insight-evidence" className="text-sm text-muted-foreground">
              {weakness.evidence}
            </p>
          ) : null}
        </div>
      </div>

      <Button
        asChild
        className={cn(
          'h-10 shrink-0 gap-1.5 px-4 font-semibold',
          // Both rows use the bone in-app primary (design.md: brass solid is
          // reserved for the auth door; the accent budget on this surface is
          // already spent on the featured card's brass tint + icon). The
          // featured row still reads as the headline via its brass-tinted card.
          'bg-foreground text-background hover:bg-foreground/90',
        )}
      >
        <Link href={href} onClick={() => insightActionClicked(kind)}>
          {meta.verb}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </li>
  );
}

function PillLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-border/70 px-3 py-1.5 text-sm text-foreground transition-colors hover:border-brass/50 hover:text-brass-text"
    >
      {label}
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:py-10">{children}</div>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-2 border-b border-border/60 pb-5">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Improve
      </span>
      <h1 className="font-display text-3xl italic tracking-[-0.01em] text-foreground sm:text-4xl">
        What to work on
      </h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Your weaknesses, ranked by what is costing you the most rating — backed by your own numbers,
        each linked to the drill that fixes it.
      </p>
    </header>
  );
}

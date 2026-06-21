'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Brain,
  Castle,
  FlaskConical,
  Layers,
  Plus,
  Repeat,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { InsightDto, RepertoireSummaryDto, WeaknessDto } from '@purechess/shared';
import { Button } from '@/components/ui/button';
import { fetchInsights } from '@/lib/api/training';
import { insightActionClicked } from '@/lib/analytics/training-events';
import { displayOpeningLabel } from '@/lib/chess-com/opening-label';
import { ChessComPanel } from '@/components/openings/chess-com-panel';
import { cn } from '@/lib/utils';

export interface OpeningsHubProps {
  repertoires: RepertoireSummaryDto[];
  loading?: boolean;
  highlightMistakesLabel?: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDrill: (id: string, name: string) => void;
  onOpeningLeakAction: (href: string) => void;
}

const LEARN_STEPS: Array<{
  step: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    step: '01',
    title: 'Study',
    description: 'Browse 3,700+ named lines. See what masters play and why.',
    href: '/openings/lab',
    icon: FlaskConical,
  },
  {
    step: '02',
    title: 'Build',
    description: 'Save the lines you actually play into your personal tree.',
    href: '/openings',
    icon: Layers,
  },
  {
    step: '03',
    title: 'Drill',
    description: 'Play your moves from memory. Spaced repetition locks them in.',
    href: '/openings',
    icon: Target,
  },
];

/** Repertoire least recently trained — best candidate for today's session. */
export function pickDrillTarget(
  repertoires: RepertoireSummaryDto[],
): RepertoireSummaryDto | null {
  const withLines = repertoires.filter((r) => r.lineCount > 0);
  if (withLines.length === 0) return null;
  return [...withLines].sort((a, b) => {
    const aTime = a.lastTrainedAt ? new Date(a.lastTrainedAt).getTime() : 0;
    const bTime = b.lastTrainedAt ? new Date(b.lastTrainedAt).getTime() : 0;
    return aTime - bTime;
  })[0];
}

function openingWeakness(insight: InsightDto | undefined): WeaknessDto | null {
  if (!insight?.weaknesses?.length) return null;
  return insight.weaknesses.find((w) => w.kind === 'opening') ?? null;
}

function isChessComOpeningWeakness(leak: WeaknessDto): boolean {
  const href = leak.actionHref ?? '';
  return (
    href.includes('chesscom=') ||
    href.includes('/openings/lab') ||
    leak.evidence?.includes('chess.com') === true
  );
}

function openingWeaknessHeadline(leak: WeaknessDto): string {
  const name = displayOpeningLabel(leak.label ?? '');
  if (isChessComOpeningWeakness(leak)) {
    return `Opening mistakes in your ${name} games`;
  }
  return leak.title ?? leak.label ?? 'Opening leak';
}

function trainingStatus(rep: RepertoireSummaryDto): {
  label: string;
  tone: 'due' | 'fresh' | 'new' | 'empty';
} {
  if (rep.lineCount === 0) return { label: 'Add lines', tone: 'empty' };
  if (!rep.lastTrainedAt) return { label: 'Ready to learn', tone: 'new' };
  const days = Math.floor((Date.now() - new Date(rep.lastTrainedAt).getTime()) / 86_400_000);
  if (days <= 0) return { label: 'Drilled today', tone: 'fresh' };
  if (days === 1) return { label: 'Due tomorrow', tone: 'fresh' };
  if (days < 4) return { label: `Trained ${days}d ago`, tone: 'fresh' };
  return { label: 'Due for review', tone: 'due' };
}

function lastTrainedLabel(iso?: string): string {
  if (!iso) return 'Never drilled';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Drilled today';
  if (days === 1) return 'Drilled yesterday';
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/**
 * The openings learning hub — a didactic front door that teaches the
 * Study → Build → Drill cycle and surfaces today's best drill target.
 */
export function OpeningsHub({
  repertoires,
  loading,
  highlightMistakesLabel,
  onNew,
  onOpen,
  onDrill,
  onOpeningLeakAction,
}: OpeningsHubProps) {
  const insights = useQuery({
    queryKey: ['insights'],
    queryFn: fetchInsights,
    staleTime: 60_000,
  });

  const drillTarget = pickDrillTarget(repertoires);
  const openingLeak = openingWeakness(insights.data);
  const totalLines = repertoires.reduce((n, r) => n + r.lineCount, 0);
  const totalMoves = repertoires.reduce((n, r) => n + r.nodeCount, 0);

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8">
      <header className="relative overflow-hidden rounded-[14px] border border-border/70 bg-surface/60 px-5 py-6 sm:px-7 sm:py-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,hsl(var(--brass)/0.12),transparent_55%),radial-gradient(ellipse_60%_50%_at_100%_100%,hsl(var(--brass)/0.06),transparent_50%)]"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Improve · Openings
            </span>
            <h1 className="mt-1 font-display text-3xl italic tracking-[-0.02em] text-foreground sm:text-4xl">
              Learn your openings — don&apos;t just memorize them
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              Aimchess fixes opening mistakes after they happen. Purechess teaches you the lines
              before the game — study named variations, build your repertoire, then drill with
              spaced repetition until the moves are automatic.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/openings/lab">
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
                Opening Lab
              </Link>
            </Button>
            <Button size="sm" onClick={onNew}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New repertoire
            </Button>
          </div>
        </div>
      </header>

      {openingLeak ? (
        <button
          type="button"
          data-testid="opening-weakness-banner"
          onClick={() => {
            insightActionClicked('opening');
            onOpeningLeakAction(openingLeak.actionHref ?? '/openings');
          }}
          className="group flex w-full items-center justify-between gap-4 rounded-[12px] border border-brass/40 bg-brass-soft/15 px-4 py-3.5 text-left transition-colors hover:bg-brass-soft/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50"
        >
          <div className="min-w-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass-text">
              From your games
            </span>
            <p className="text-sm text-foreground">
              <span className="font-medium">{openingWeaknessHeadline(openingLeak)}</span>
              {openingLeak.evidence ? (
                <span className="text-muted-foreground"> — {openingLeak.evidence}</span>
              ) : null}
            </p>
            {isChessComOpeningWeakness(openingLeak) ? (
              <p className="mt-1 text-xs text-muted-foreground">
                We analyzed your synced chess.com games with Stockfish. Tap{' '}
                <span className="font-medium text-foreground">Fix with coach</span> on any row for a
                step-by-step walkthrough — your move vs the better move, then you try it yourself.
              </p>
            ) : null}
          </div>
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brass-text">
            {isChessComOpeningWeakness(openingLeak) ? 'Review mistakes' : 'Train the line'}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </button>
      ) : null}

      <ChessComPanel highlightLabel={highlightMistakesLabel} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <TodayDrillCard
          loading={loading}
          drillTarget={drillTarget}
          totalLines={totalLines}
          onDrill={onDrill}
          onNew={onNew}
        />
        <StatsPanel
          repertoireCount={repertoires.length}
          totalLines={totalLines}
          totalMoves={totalMoves}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            How to learn openings
          </h2>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Study → Build → Drill
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {LEARN_STEPS.map((step) => (
            <LearnStepCard key={step.step} {...step} onBuild={onNew} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Your repertoires
          </h2>
          {repertoires.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {repertoires.length} set{repertoires.length === 1 ? '' : 's'} · {totalLines} line
              {totalLines === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : repertoires.length === 0 ? (
          <EmptyRepertoires onNew={onNew} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {repertoires.map((rep) => (
              <RepertoireCard
                key={rep.id}
                rep={rep}
                onOpen={() => onOpen(rep.id)}
                onDrill={() => onDrill(rep.id, rep.name)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TodayDrillCard({
  loading,
  drillTarget,
  totalLines,
  onDrill,
  onNew,
}: {
  loading?: boolean;
  drillTarget: RepertoireSummaryDto | null;
  totalLines: number;
  onDrill: (id: string, name: string) => void;
  onNew: () => void;
}) {
  return (
    <div
      data-testid="today-drill-card"
      className="flex flex-col justify-between gap-5 rounded-[12px] border border-brass/35 bg-brass-soft/12 p-5 shadow-elevated sm:p-6"
    >
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-brass/15 text-brass-text">
          <Brain className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass-text">
            Today&apos;s session
          </span>
          <h2 className="mt-0.5 font-display text-xl italic text-foreground sm:text-2xl">
            {loading
              ? 'Loading your plan…'
              : drillTarget
                ? `Drill ${drillTarget.name}`
                : 'Build your first repertoire'}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {loading ? (
              'Checking which lines need review.'
            ) : drillTarget ? (
              <>
                {drillTarget.lineCount} line{drillTarget.lineCount === 1 ? '' : 's'} ·{' '}
                {lastTrainedLabel(drillTarget.lastTrainedAt)}. Play your booked moves from memory —
                opponent replies auto-play, and off-book moves come back sooner.
              </>
            ) : (
              'Import a PGN or build from the opening explorer. Once you have lines, spaced repetition keeps them sharp.'
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {drillTarget ? (
          <>
            <Button
              onClick={() => onDrill(drillTarget.id, drillTarget.name)}
              data-testid="today-drill-cta"
            >
              <Target className="h-4 w-4" aria-hidden="true" />
              Start drilling
            </Button>
            <Button asChild variant="outline">
              <Link href="/openings/lab">
                <BookMarked className="h-4 w-4" aria-hidden="true" />
                Study a line first
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onNew} data-testid="today-drill-cta">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create repertoire
            </Button>
            <Button asChild variant="outline">
              <Link href="/openings/lab">
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
                Browse Opening Lab
              </Link>
            </Button>
          </>
        )}
        {totalLines > 0 ? (
          <p className="w-full text-xs text-muted-foreground">
            ~{Math.min(8, totalLines)} lines per session · SM-2 scheduling
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StatsPanel({
  repertoireCount,
  totalLines,
  totalMoves,
}: {
  repertoireCount: number;
  totalLines: number;
  totalMoves: number;
}) {
  const stats = [
    { label: 'Repertoires', value: repertoireCount },
    { label: 'Lines saved', value: totalLines },
    { label: 'Moves in book', value: totalMoves },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-[12px] border border-border/70 bg-surface/55 p-5 shadow-inner-hairline">
      <div className="flex items-center gap-2">
        <Repeat className="h-4 w-4 text-brass" aria-hidden="true" />
        <h2 className="font-medium text-foreground">Spaced repetition</h2>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Lines you nail on the first try wait longer before review. Miss a move and it returns
        tomorrow. Same science as flashcards — applied to your opening tree.
      </p>
      <dl className="mt-auto grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[8px] border border-border/60 bg-background/40 px-3 py-2.5">
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</dt>
            <dd className="mt-0.5 font-display text-2xl italic tabular-nums text-foreground">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function LearnStepCard({
  step,
  title,
  description,
  href,
  icon: Icon,
  onBuild,
  buildHref,
}: {
  step: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  onBuild: () => void;
  buildHref?: string;
}) {
  const isBuild = title === 'Build';

  return (
    <div className="group flex flex-col gap-3 rounded-[10px] border border-border/70 bg-surface/60 p-4 transition-colors hover:border-brass/45">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tabular-nums text-brass-text">{step}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-muted text-muted-foreground transition-colors group-hover:bg-brass/15 group-hover:text-brass-text">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div>
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {isBuild ? (
        buildHref ? (
          <Link
            href={buildHref}
            className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-brass-text hover:underline"
          >
            Start building
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onBuild}
            className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-brass-text hover:underline"
          >
            Start building
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        )
      ) : (
        <Link
          href={href}
          className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-brass-text hover:underline"
        >
          {title === 'Study' ? 'Open Lab' : 'Go to repertoires'}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function RepertoireCard({
  rep,
  onOpen,
  onDrill,
}: {
  rep: RepertoireSummaryDto;
  onOpen: () => void;
  onDrill: () => void;
}) {
  const status = trainingStatus(rep);

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface/60 p-4 transition-colors hover:border-brass/45">
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50 rounded-md"
      >
        <div className="flex items-center gap-2">
          <Castle className="h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
          <span className="truncate font-medium text-foreground">{rep.name}</span>
          <ColorChip color={rep.color} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {rep.lineCount} line{rep.lineCount === 1 ? '' : 's'} · {rep.nodeCount} move
          {rep.nodeCount === 1 ? '' : 's'}
        </p>
      </button>

      <div className="flex items-center justify-between gap-3">
        <StatusBadge label={status.label} tone={status.tone} />
        <Button
          size="sm"
          variant={status.tone === 'due' || status.tone === 'new' ? 'default' : 'outline'}
          onClick={onDrill}
          disabled={rep.lineCount === 0}
          className="shrink-0"
        >
          <Target className="h-4 w-4" aria-hidden="true" />
          Drill
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'due' | 'fresh' | 'new' | 'empty';
}) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[11px] font-medium',
        tone === 'due' && 'border-destructive/40 bg-destructive/10 text-destructive',
        tone === 'new' && 'border-brass/40 bg-brass/10 text-brass-text',
        tone === 'fresh' && 'border-border bg-background/50 text-muted-foreground',
        tone === 'empty' && 'border-border bg-background/50 text-muted-foreground',
      )}
    >
      {label}
    </span>
  );
}

function ColorChip({ color }: { color: 'white' | 'black' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        color === 'white'
          ? 'border-border bg-foreground/5 text-foreground'
          : 'border-border bg-background text-muted-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 rounded-full ring-1 ring-border',
          color === 'white' ? 'bg-board-light' : 'bg-board-dark',
        )}
      />
      {color}
    </span>
  );
}

function EmptyRepertoires({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-[12px] border border-dashed border-border bg-surface/40 p-8 text-center sm:p-10">
      <BookOpen className="mx-auto mb-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium text-foreground">Start with one opening you play every game</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Pick a line in Opening Lab, save it here, then drill until you don&apos;t have to think in
        the opening. One solid repertoire beats knowing twenty lines poorly.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={onNew}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New repertoire
        </Button>
        <Button asChild variant="outline">
          <Link href="/openings/lab">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Explore Opening Lab
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Signed-out marketing shell — still teaches the methodology. */
export function OpeningsSignedOut() {
  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8">
      <header className="relative overflow-hidden rounded-[14px] border border-border/70 bg-surface/60 px-5 py-8 text-center sm:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,hsl(var(--brass)/0.14),transparent_60%)]"
        />
        <div className="relative">
          <BookOpen className="mx-auto mb-4 h-8 w-8 text-brass" aria-hidden="true" />
          <h1 className="font-display text-3xl italic text-foreground sm:text-4xl">
            Learn openings the right way
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Study named lines, build your personal repertoire, and drill with spaced repetition.
            Sign in to save progress and track which lines need review.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button asChild>
              <Link href="/login?return=/openings">Sign in to start</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/openings/lab">
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
                Browse Opening Lab
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {LEARN_STEPS.map((step) => (
          <LearnStepCard
            key={step.step}
            {...step}
            onBuild={() => {}}
            buildHref="/login?return=/openings"
          />
        ))}
      </div>
    </div>
  );
}
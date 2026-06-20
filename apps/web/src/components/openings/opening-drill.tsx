'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, RotateCcw, Target } from 'lucide-react';
import type {
  DrillStepDto,
  DrillLinesDto,
  LabDrillLinesDto,
  MoveIntent,
  RepertoireColorDto,
} from '@purechess/shared';
import { Chessboard } from '@/components/board';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { Button } from '@/components/ui/button';
import { bestMoveArrow, type BoardShape } from '@/lib/board/annotations';
import { gradeDrill } from '@/lib/api/repertoire';
import { gradeLabDrill } from '@/lib/api/opening-lab';
import { openingDrillCompleted } from '@/lib/analytics/training-events';
import {
  useOpeningDrill,
  type DrillLineResult,
  type DrillSummary,
} from '@/hooks/use-opening-drill';
import { cn } from '@/lib/utils';

export interface OpeningDrillProps {
  repertoireName: string;
  drill: DrillLinesDto | LabDrillLinesDto;
  onBack: () => void;
  /** Restart with a freshly fetched session. */
  onRestart?: () => void;
  /** Repertoire drill — persists grades to Postgres. */
  repertoireId?: string;
  /** Opening Lab family drill — persists grades to Redis. */
  labDrill?: { family: string; color: RepertoireColorDto };
  backLabel?: string;
}

function moveLabel(ply: number): string | null {
  return ply % 2 === 1 ? `${Math.ceil(ply / 2)}.` : null;
}

/** Fixed-height move strip: the line can grow horizontally without moving the board. */
function DrillLineStrip({
  steps,
  activePly,
}: {
  steps: DrillStepDto[];
  activePly: number;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stripRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [activePly, steps]);

  return (
    <div
      ref={stripRef}
      className="flex h-10 min-w-0 shrink-0 items-center gap-2 overflow-x-auto rounded-[10px] border border-border/70 bg-surface/55 px-3 shadow-inner-hairline"
      aria-live="polite"
    >
      <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-text">
        Line
      </span>
      {steps.length > 0 ? (
        <ol className="flex min-w-0 items-center gap-2 whitespace-nowrap font-mono text-xs text-muted-foreground">
          {steps.map((step, idx) => {
            const ply = idx + 1;
            const label = moveLabel(ply);
            const active = ply === activePly;
            return (
              <li key={`${step.uci}-${idx}`} className="inline-flex items-center gap-1">
                {label && <span className="text-brass-text/80">{label}</span>}
                <span
                  className={cn(
                    'rounded px-1 py-0.5 transition-colors',
                    active
                      ? 'bg-brass/15 font-semibold text-foreground ring-1 ring-brass/30'
                      : 'text-muted-foreground',
                  )}
                >
                  {step.san}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          The next line will appear here.
        </p>
      )}
    </div>
  );
}

/** Quiet "to move" label + line/move progress. */
function DrillPrompt({
  toMove,
  outOfBook,
  lineNumber,
  totalLines,
  moveNumber,
  lineLength,
}: {
  toMove: 'white' | 'black';
  outOfBook: boolean;
  lineNumber: number;
  totalLines: number;
  moveNumber: number;
  lineLength: number;
}) {
  return (
    <div className="grid min-h-10 gap-1 rounded-[10px] border border-border/70 bg-background/45 px-3 py-2 text-sm shadow-inner-hairline sm:flex sm:items-center sm:justify-between sm:gap-3">
      <span
        className={cn(
          'inline-flex items-center gap-2 font-medium',
          outOfBook ? 'text-destructive' : 'text-foreground',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'h-2.5 w-2.5 rounded-full ring-1 ring-border',
            toMove === 'white' ? 'bg-[#f0ede5]' : 'bg-[#1a1e19]',
          )}
        />
        {outOfBook ? 'Out of book — the booked move is shown' : `${toMove} to move`}
      </span>
      <span className="tabular-nums text-muted-foreground">
        Line {lineNumber}/{totalLines} · move {moveNumber} of {lineLength}
      </span>
    </div>
  );
}

/** End-of-session readout: lines trained, % first-try, per-line next-due. */
function DrillSummaryView({
  summary,
  nextDueByPath,
  onBack,
  onRestart,
  backLabel = 'Back',
}: {
  summary: DrillSummary;
  nextDueByPath: Map<string, string>;
  onBack: () => void;
  onRestart?: () => void;
  backLabel?: string;
}) {
  const pct = Math.round(summary.firstTryRate * 100);
  return (
    <div className="space-y-5 rounded-[12px] border border-border bg-surface/60 p-6 text-center">
      <Check className="mx-auto h-8 w-8 text-brass" aria-hidden="true" />
      <div>
        <h2 className="font-display text-2xl italic text-foreground">Session complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary.linesTrained} line{summary.linesTrained === 1 ? '' : 's'} trained ·{' '}
          <span className="font-medium text-foreground">{pct}%</span> first-try
        </p>
      </div>

      {summary.results.length > 0 && (
        <ul className="mx-auto max-w-sm space-y-1.5 text-left text-sm">
          {summary.results.map((r, i) => (
            <li
              key={r.nodePath + i}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2"
            >
              <span
                className={cn(
                  'inline-flex items-center gap-1.5',
                  r.correctFirstTry ? 'text-success' : 'text-destructive',
                )}
              >
                {r.correctFirstTry ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {r.correctFirstTry ? 'Clean' : `${r.misses} miss${r.misses === 1 ? '' : 'es'}`}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {nextDueLabel(nextDueByPath.get(r.nodePath))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {backLabel ?? 'Back'}
        </Button>
        {onRestart && (
          <Button onClick={onRestart}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Drill again
          </Button>
        )}
      </div>
    </div>
  );
}

/** Relative "next due" label for a grade result. */
function nextDueLabel(iso?: string): string {
  if (!iso) return '';
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return 'Due again today';
  if (days === 1) return 'Next: tomorrow';
  return `Next: ${days}d`;
}

/**
 * The opening trainer surface. Walks the queued lines with the same Chessboard
 * the rest of the app uses: opponent replies auto-play, the user must produce
 * the booked move, and an off-book legal move draws the book-move arrow (via
 * the existing `autoShapes` annotation support — NOT a fork) and counts as a
 * miss. Each finished line is graded into the spaced-repetition queue; the
 * session ends with a lines-trained / first-try / next-due readout.
 *
 * Server-authoritative: the client reports each line's `correctFirstTry`; the
 * server owns the scheduling math and returns the next-due date.
 */
export function OpeningDrill({
  repertoireId,
  repertoireName,
  drill,
  onBack,
  onRestart,
  labDrill,
  backLabel = 'Back to repertoire',
}: OpeningDrillProps) {
  const [started, setStarted] = useState(false);
  // Per-line next-due, captured from each grade response, for the summary.
  const nextDueByPath = useRef<Map<string, string>>(new Map());

  const handleGradeLine = useCallback(
    (result: DrillLineResult) => {
      const persist = labDrill
        ? gradeLabDrill({
            family: labDrill.family,
            epd: result.nodePath,
            color: labDrill.color,
            correctFirstTry: result.correctFirstTry,
          })
        : repertoireId
          ? gradeDrill(repertoireId, {
              nodePath: result.nodePath,
              correctFirstTry: result.correctFirstTry,
            })
          : null;
      if (!persist) return;
      persist
        .then((res) => {
          nextDueByPath.current.set(result.nodePath, res.nextDueAt);
        })
        .catch(() => {
          // A grade write failing never blocks the drill — the queue is best-effort.
        });
    },
    [repertoireId, labDrill],
  );

  const { state, start, onMove } = useOpeningDrill({
    lines: drill.lines,
    color: drill.color,
    onGradeLine: handleGradeLine,
    onComplete: (summary) =>
      openingDrillCompleted({
        lines: summary.linesTrained,
        accuracy: Math.round(summary.firstTryRate * 100),
      }),
  });

  const handleStart = useCallback(() => {
    setStarted(true);
    start();
  }, [start]);

  const handleMove = useCallback((intent: MoveIntent) => onMove(intent), [onMove]);

  // The book-move correction arrow (existing annotation support), green.
  const autoShapes = useMemo<BoardShape[]>(() => {
    if (!state.bookMove) return [];
    const arrow = bestMoveArrow(state.bookMove, 'green');
    return arrow ? [arrow] : [];
  }, [state.bookMove]);

  const toMove: 'white' | 'black' = state.fen.split(' ')[1] === 'b' ? 'black' : 'white';
  const activeLine = drill.lines[state.lineNumber - 1];

  // --- Empty queue: nothing due, nothing new --------------------------------
  if (drill.lines.length === 0) {
    return (
      <div className="space-y-5">
        <DrillHeader
          name={repertoireName}
          onBack={onBack}
          dueLineCount={drill.dueLineCount}
          backLabel={backLabel}
        />
        <div className="rounded-[12px] border border-dashed border-border bg-surface/40 p-10 text-center">
          <Check className="mx-auto mb-3 h-7 w-7 text-brass" aria-hidden="true" />
          <p className="font-medium text-foreground">Nothing to drill right now</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Every line is up to date. Come back when lines are due, or add more lines to this
            repertoire.
          </p>
        </div>
      </div>
    );
  }

  return (
    <BoardSettingsProvider>
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <DrillHeader
          name={repertoireName}
          onBack={onBack}
          dueLineCount={drill.dueLineCount}
          backLabel={backLabel}
        />

        {!started ? (
          <div className="rounded-[12px] border border-border bg-surface/60 p-8 text-center">
            <Target className="mx-auto mb-3 h-7 w-7 text-brass" aria-hidden="true" />
            <p className="font-medium text-foreground">
              {drill.lines.length} line{drill.lines.length === 1 ? '' : 's'} ready
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Play your booked moves — the opponent replies for you. Off-book moves are flagged
              and the line comes back sooner.
            </p>
            <Button className="mt-5" onClick={handleStart} data-testid="drill-start">
              Start drilling
            </Button>
          </div>
        ) : state.phase === 'done' && state.summary ? (
          <DrillSummaryView
            summary={state.summary}
            nextDueByPath={nextDueByPath.current}
            onBack={onBack}
            onRestart={onRestart}
            backLabel={backLabel}
          />
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
            <main className="flex min-h-0 min-w-0 flex-col gap-3">
              <DrillPrompt
                toMove={toMove}
                outOfBook={!!state.bookMove}
                lineNumber={state.lineNumber}
                totalLines={state.totalLines}
                moveNumber={state.moveNumber}
                lineLength={state.lineLength}
              />
              <DrillLineStrip steps={activeLine?.steps ?? []} activePly={state.moveNumber} />
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <div className="mx-auto aspect-square w-full max-w-[min(100%,calc(100dvh-var(--top-bar)-16rem))] lg:h-full lg:max-h-full lg:w-auto lg:max-w-full">
                  <Chessboard
                    position={state.fen}
                    orientation={drill.color}
                    onMove={handleMove}
                    lastMove={
                      state.lastMove
                        ? { from: state.lastMove[0] as never, to: state.lastMove[1] as never }
                        : undefined
                    }
                    autoShapes={autoShapes}
                  />
                </div>
              </div>
            </main>
            <aside className="hidden min-h-0 min-w-0 flex-col gap-3 lg:flex">
              <div className="rounded-[10px] border border-border bg-surface/60 p-4 text-sm shadow-inner-hairline">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-text">
                  Session
                </p>
                <p className="font-medium text-foreground">{repertoireName}</p>
                <p className="mt-1 text-muted-foreground">
                  Drilling {drill.color}. {state.totalLines} line
                  {state.totalLines === 1 ? '' : 's'} this session.
                </p>
              </div>
              <div className="min-h-0 flex-1 rounded-[10px] border border-border bg-surface/45 p-4 text-sm shadow-inner-hairline">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-text">
                  Current
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Line</dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {state.lineNumber}/{state.totalLines}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Ply</dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {state.moveNumber}/{state.lineLength}
                    </dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>
        )}
      </div>
    </BoardSettingsProvider>
  );
}

function DrillHeader({
  name,
  onBack,
  dueLineCount,
  backLabel = 'Back',
}: {
  name: string;
  onBack: () => void;
  dueLineCount: number;
  backLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {backLabel}
      </button>
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl italic text-foreground">Drill: {name}</h2>
        {dueLineCount > 0 && (
          <span className="rounded-full border border-brass/40 bg-brass/10 px-2 py-0.5 text-xs font-medium text-brass">
            {dueLineCount} due
          </span>
        )}
      </div>
    </div>
  );
}

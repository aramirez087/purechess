'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, LogIn, XCircle } from 'lucide-react';
import type { ReviewDueDto, Square } from '@purechess/shared';
import { Chessboard } from '@/components/board/chessboard';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocalPuzzle } from '@/hooks/use-local-puzzle';
import { TrainingAnnouncer } from '@/components/training/training-announcer';
import { focusBoard } from '@/lib/board/focus-board';
import { gradeReview } from '@/lib/api/puzzles';

/**
 * Spaced-repetition review — a thin TrainingSession-style loop over the due
 * queue. Unlike the theme trainer it does NOT stream from `fetchNextPuzzle`
 * (the queue is pre-fetched and fixed) and each outcome calls `gradeReview`
 * (source:'review') instead of the normal `recordAttempt` path — grading owns
 * the SM-2 reschedule. Reuses {@link useLocalPuzzle} for the solve mechanics,
 * exactly like Puzzle Rush.
 *
 * Three states:
 *   - signed out → a sign-in prompt.
 *   - nothing due → a calm "all caught up" empty state with the next-due date.
 *   - due cards → the review loop, then an end-of-queue summary.
 */

const AUTO_ADVANCE_MS = 1200;

export interface ReviewClientProps {
  signedIn: boolean;
  initialDue: ReviewDueDto;
}

export function ReviewClient({ signedIn, initialDue }: ReviewClientProps) {
  if (!signedIn) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="font-display text-3xl italic tracking-[-0.01em] text-foreground">Review</h1>
        <p className="text-sm text-muted-foreground">
          Puzzles you miss come back at growing intervals until they stick. Sign in to build your
          review queue.
        </p>
        <Button
          asChild
          className="h-11 bg-foreground font-semibold text-background hover:bg-foreground/90"
        >
          <Link href="/login?return=/puzzles/review">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Sign in to review
          </Link>
        </Button>
      </div>
    );
  }

  if (initialDue.dueCount === 0 || initialDue.puzzles.length === 0) {
    return <AllCaughtUp nextDueAt={initialDue.nextDueAt ?? null} />;
  }

  return <ReviewRun initialDue={initialDue} />;
}

/** Calm empty state: nothing due, with the next-due date when one exists. */
function AllCaughtUp({ nextDueAt }: { nextDueAt: string | null }) {
  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 py-16 text-center"
      data-testid="review-empty"
    >
      <CheckCircle2 className="h-10 w-10 text-brass" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl italic tracking-[-0.01em] text-foreground sm:text-3xl">
          All caught up
        </h1>
        <p className="text-sm text-muted-foreground">
          {nextDueAt ? (
            <>
              Nothing due right now. Your next review is{' '}
              <span className="font-medium text-foreground">{formatDue(nextDueAt)}</span>.
            </>
          ) : (
            <>Nothing due. Miss a puzzle anywhere and it&apos;ll show up here to drill.</>
          )}
        </p>
      </div>
      <Button asChild className="h-11 bg-foreground font-semibold text-background hover:bg-foreground/90">
        <Link href="/puzzles/train">
          Train by theme
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}

interface QueueOutcome {
  solved: boolean;
  nextDueAt: string | null;
  graduated: boolean;
}

/** The active review loop over a fixed, pre-fetched due queue. */
function ReviewRun({ initialDue }: { initialDue: ReviewDueDto }) {
  const queue = initialDue.puzzles;
  const dueCount = initialDue.dueCount;

  const [index, setIndex] = useState(0);
  const [solved, setSolved] = useState(0);
  const [outcome, setOutcome] = useState<QueueOutcome | null>(null);
  const [done, setDone] = useState(false);
  // The most recent next-due, surfaced in the summary ("next review in X").
  const [lastNextDueAt, setLastNextDueAt] = useState<string | null>(null);
  // Polite SR outcome line (verdict + remaining); the board narrates the move.
  const [announcement, setAnnouncement] = useState('');

  const boardWrapRef = useRef<HTMLDivElement>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settledRef = useRef(false);
  const solvedRef = useRef(0);
  const msRef = useRef<number | null>(null);

  const clearAdvance = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAdvance(), [clearAdvance]);

  const advance = useCallback(() => {
    clearAdvance();
    settledRef.current = false;
    setOutcome(null);
    setIndex((i) => {
      const next = i + 1;
      if (next >= queue.length) {
        setDone(true);
        return i;
      }
      // Auto-advance focus restore for keyboard solvers (see focusBoard).
      requestAnimationFrame(() => focusBoard(boardWrapRef.current));
      return next;
    });
  }, [queue.length, clearAdvance]);

  const settle = useCallback(
    (wasSolved: boolean) => {
      if (settledRef.current) return;
      settledRef.current = true;

      const puzzle = queue[index];
      const nextSolved = wasSolved ? solvedRef.current + 1 : solvedRef.current;
      if (wasSolved) {
        solvedRef.current = nextSolved;
        setSolved(nextSolved);
      }

      // Politely narrate the verdict + how many reviews remain in the queue.
      const remaining = Math.max(0, queue.length - (index + 1));
      setAnnouncement(
        wasSolved
          ? `Correct. ${remaining} review${remaining === 1 ? '' : 's'} remaining.`
          : `Not the move. ${remaining} review${remaining === 1 ? '' : 's'} remaining.`,
      );

      // Grade owns the SM-2 reschedule (NOT the normal recordAttempt path).
      void (async () => {
        let nextDueAt: string | null = null;
        let graduated = false;
        if (puzzle) {
          try {
            const res = await gradeReview(puzzle.id, {
              solved: wasSolved,
              msToSolve: msRef.current ?? undefined,
            });
            nextDueAt = res.nextDueAt;
            graduated = res.graduated;
            setLastNextDueAt(res.nextDueAt);
          } catch {
            // Outcome still shown locally even if grading fails.
          }
        }
        setOutcome({ solved: wasSolved, nextDueAt, graduated });
      })();

      advanceTimerRef.current = setTimeout(() => advance(), AUTO_ADVANCE_MS);
    },
    [queue, index, advance],
  );

  const handleSolved = useCallback(
    ({ msToSolve }: { msToSolve: number }) => {
      msRef.current = msToSolve;
      settle(true);
    },
    [settle],
  );

  const handleFailed = useCallback(() => {
    msRef.current = null;
    settle(false);
  }, [settle]);

  const current = done ? null : queue[index] ?? null;

  const { state, onMove } = useLocalPuzzle({
    puzzle: current,
    onSolved: handleSolved,
    onFailed: handleFailed,
  });

  if (done) {
    return (
      <ReviewSummary
        solved={solved}
        total={queue.length}
        nextDueAt={lastNextDueAt}
      />
    );
  }

  return (
    <BoardSettingsProvider>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:py-8">
        <header className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl italic tracking-[-0.01em] text-foreground sm:text-3xl">
            Review
          </h1>
          <span
            className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground"
            data-testid="review-progress"
          >
            {dueCount} due
          </span>
        </header>

        <div className="mx-auto w-full max-w-[560px]">
          <div className="relative w-full" ref={boardWrapRef}>
            <Chessboard
              position={state.fen}
              orientation={state.solvingColor === 'w' ? 'white' : 'black'}
              readOnly={state.phase !== 'player'}
              lastMove={
                state.lastMove
                  ? { from: state.lastMove[0] as Square, to: state.lastMove[1] as Square }
                  : undefined
              }
              onMove={(m) => {
                if (!m.from || !m.to) return;
                onMove(m.from + m.to + (m.promotion ?? ''));
              }}
            />

            {outcome?.solved && (
              <Overlay tone="success">
                <CheckCircle2 className="h-8 w-8 text-brass" aria-hidden="true" />
                <p className="text-base font-semibold text-foreground">
                  {outcome.graduated ? 'Learned' : 'Solved'}
                </p>
                <ReviewReadout outcome={outcome} />
              </Overlay>
            )}
            {outcome && !outcome.solved && (
              <Overlay tone="error">
                <XCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
                <p className="text-base font-semibold text-foreground">Incorrect</p>
                <ReviewReadout outcome={outcome} />
              </Overlay>
            )}
          </div>
        </div>

        <p className="min-h-[1.25rem] text-center text-sm text-muted-foreground">
          {state.phase === 'player' && !outcome ? (
            <>
              Find the best move for{' '}
              <span className="font-medium text-foreground">
                {state.solvingColor === 'w' ? 'White' : 'Black'}
              </span>
              .
            </>
          ) : (
            ' '
          )}
        </p>

        <TrainingAnnouncer message={announcement} />
      </div>
    </BoardSettingsProvider>
  );
}

function ReviewReadout({ outcome }: { outcome: QueueOutcome }) {
  if (outcome.graduated) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="review-readout">
        Off the queue — you&apos;ve got this one.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground" data-testid="review-readout">
      {outcome.nextDueAt ? <>Next review {formatDue(outcome.nextDueAt)}</> : 'Rescheduled'}
    </p>
  );
}

function ReviewSummary({
  solved,
  total,
  nextDueAt,
}: {
  solved: number;
  total: number;
  nextDueAt: string | null;
}) {
  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 text-center"
      data-testid="review-summary"
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl italic tracking-[-0.01em] text-foreground sm:text-3xl">
          Review done
        </h1>
        <p className="text-sm text-muted-foreground">You worked the whole queue.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Solved" value={`${solved} / ${total}`} />
        <Stat label="Next review" value={nextDueAt ? formatDue(nextDueAt) : '—'} />
      </div>

      <div className="flex flex-col gap-2">
        <Button
          asChild
          className="h-11 bg-foreground font-semibold text-background hover:bg-foreground/90"
        >
          <Link href="/puzzles/train">
            Train by theme
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost" className="h-9 text-muted-foreground">
          <Link href="/puzzles/train">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-border bg-surface p-3.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className="text-lg font-semibold text-foreground">{value}</span>
    </div>
  );
}

function Overlay({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'error';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-30 flex flex-col items-center justify-center gap-2.5 rounded-[4px] p-6 text-center backdrop-blur-sm',
        tone === 'neutral' ? 'bg-background/55' : 'bg-background/75',
      )}
    >
      {children}
    </div>
  );
}

/** Humanize a next-due ISO into "today", "tomorrow", or "in N days". */
function formatDue(iso: string): string {
  const due = new Date(iso).getTime();
  if (Number.isNaN(due)) return 'soon';
  const days = Math.round((due - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

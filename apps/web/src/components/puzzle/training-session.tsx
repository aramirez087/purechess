'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react';
import type { PuzzleDto, PuzzleSource, PuzzleThemeStatDto, Square } from '@purechess/shared';
import { Chessboard } from '@/components/board/chessboard';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocalPuzzle } from '@/hooks/use-local-puzzle';
import { humanizeTheme } from '@/components/puzzle/theme-tile';
import { SolveExplanation } from '@/components/puzzle/solve-explanation';
import { fetchNextPuzzle, fetchPuzzleStats, recordAttempt } from '@/lib/api/puzzles';

/**
 * The reusable active-drill shell. Streams rating-appropriate puzzles for a
 * theme (or unfiltered when `theme` is null), renders the shared Chessboard
 * via {@link useLocalPuzzle}, reports each outcome to the server, and shows a
 * session summary at the target. Rush (S05), review (S06), and mistakes (S07)
 * compose this same shell — only `source` (and how puzzles are sourced) differ.
 *
 * The client is server-authoritative: it POSTs `{ solved, msToSolve, source }`
 * and reads back the server-computed rating delta; it never sets a rating.
 */

export interface TrainingSessionProps {
  /** Theme slug to drill, or null for an unfiltered stream. */
  theme: string | null;
  /** How attempts are tagged server-side. */
  source: PuzzleSource;
  /** Solves needed to complete the session. Defaults to 10. */
  target?: number;
  /** Return to the selection screen. */
  onBack?: () => void;
  /** Switch theme (selection screen). Falls back to onBack when omitted. */
  onChangeTheme?: () => void;
}

type AttemptOutcome = {
  solved: boolean;
  puzzleRating: number;
  ratingDelta: number | null;
};

const AUTO_ADVANCE_MS = 1200;
const DEFAULT_TARGET = 10;

function accuracyOf(stats: PuzzleThemeStatDto[], theme: string | null): number | null {
  if (!theme) return null;
  const row = stats.find((s) => s.slug === theme);
  if (!row || row.attempts === 0) return null;
  return typeof row.accuracy === 'number' ? row.accuracy : row.solved / row.attempts;
}

export function TrainingSession({
  theme,
  source,
  target = DEFAULT_TARGET,
  onBack,
  onChangeTheme,
}: TrainingSessionProps) {
  const [puzzle, setPuzzle] = useState<PuzzleDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solved, setSolved] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [outcome, setOutcome] = useState<AttemptOutcome | null>(null);
  const [done, setDone] = useState(false);

  // Theme accuracy captured before the first puzzle and again at completion.
  const [startAccuracy, setStartAccuracy] = useState<number | null>(null);
  const [endAccuracy, setEndAccuracy] = useState<number | null>(null);

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards the per-puzzle recordAttempt so it fires exactly once.
  const recordedRef = useRef(false);
  const solvedRef = useRef(0);

  const clearAdvance = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const loadNext = useCallback(async () => {
    clearAdvance();
    recordedRef.current = false;
    setOutcome(null);
    setError(null);
    setLoading(true);
    try {
      const next = await fetchNextPuzzle(theme ? { theme } : {});
      setPuzzle(next);
    } catch {
      setError('Could not load the next puzzle.');
      setPuzzle(null);
    } finally {
      setLoading(false);
    }
  }, [theme, clearAdvance]);

  // Capture the starting theme accuracy, then load the first puzzle.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stats = await fetchPuzzleStats();
        if (!cancelled) setStartAccuracy(accuracyOf(stats, theme));
      } catch {
        // Logged out / no stats yet — leave null.
      }
    })();
    void loadNext();
    return () => {
      cancelled = true;
      clearAdvance();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishSession = useCallback(async () => {
    try {
      const stats = await fetchPuzzleStats();
      setEndAccuracy(accuracyOf(stats, theme));
    } catch {
      // ignore
    }
    setDone(true);
  }, [theme]);

  const settle = useCallback(
    (wasSolved: boolean) => {
      if (recordedRef.current || !puzzle) return;
      recordedRef.current = true;
      setAttempted((n) => n + 1);
      const nextSolved = wasSolved ? solvedRef.current + 1 : solvedRef.current;
      if (wasSolved) {
        solvedRef.current = nextSolved;
        setSolved(nextSolved);
      }

      // Report the outcome; read back the server-computed rating delta.
      void (async () => {
        let ratingDelta: number | null = null;
        try {
          const result = await recordAttempt(puzzle.id, {
            solved: wasSolved,
            msToSolve: msToSolveRef.current ?? undefined,
            source,
          });
          ratingDelta = typeof result.ratingDelta === 'number' ? result.ratingDelta : null;
        } catch {
          // Outcome still shown locally even if the report fails.
        }
        setOutcome({ solved: wasSolved, puzzleRating: puzzle.rating, ratingDelta });
      })();

      if (nextSolved >= target) {
        // Let the final outcome render, then summarize.
        advanceTimerRef.current = setTimeout(() => void finishSession(), AUTO_ADVANCE_MS);
      } else {
        advanceTimerRef.current = setTimeout(() => void loadNext(), AUTO_ADVANCE_MS);
      }
    },
    [puzzle, source, target, finishSession, loadNext],
  );

  const msToSolveRef = useRef<number | null>(null);

  const handleSolved = useCallback(
    ({ msToSolve }: { msToSolve: number }) => {
      msToSolveRef.current = msToSolve;
      settle(true);
    },
    [settle],
  );

  const handleFailed = useCallback(() => {
    msToSolveRef.current = null;
    settle(false);
  }, [settle]);

  const { state, onMove } = useLocalPuzzle({
    puzzle,
    onSolved: handleSolved,
    onFailed: handleFailed,
  });

  const themeLabel = theme ? humanizeTheme(theme) : 'Mixed';
  const progressPct = Math.min(100, Math.round((solved / target) * 100));

  if (done) {
    return (
      <SessionSummary
        themeLabel={themeLabel}
        solved={solved}
        attempted={attempted}
        startAccuracy={startAccuracy}
        endAccuracy={endAccuracy}
        onTrainMore={() => {
          setSolved(0);
          setAttempted(0);
          solvedRef.current = 0;
          setStartAccuracy(endAccuracy);
          setEndAccuracy(null);
          setDone(false);
          void loadNext();
        }}
        onChangeTheme={onChangeTheme ?? onBack}
        onBack={onBack}
      />
    );
  }

  return (
    <BoardSettingsProvider>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:py-8">
        <header className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="font-display text-2xl italic tracking-[-0.01em] text-foreground sm:text-3xl">
              {themeLabel}
            </h1>
            <span
              className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground"
              data-testid="session-progress"
            >
              solved {solved} / attempted {attempted}
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-raised"
            role="progressbar"
            aria-valuenow={solved}
            aria-valuemin={0}
            aria-valuemax={target}
            aria-label={`Progress toward ${target} solves`}
          >
            <div
              className="h-full rounded-full bg-brass transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </header>

        <div className="mx-auto w-full max-w-[560px]">
          <div className="relative w-full">
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

            {loading && !error && (
              <Overlay>
                <Loader2 className="h-7 w-7 animate-spin text-brass" aria-label="Loading puzzle" />
              </Overlay>
            )}
            {error && (
              <Overlay>
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" onClick={() => void loadNext()} className="h-9">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Retry
                </Button>
              </Overlay>
            )}
            {outcome?.solved && (
              <Overlay tone="success">
                <CheckCircle2 className="h-8 w-8 text-brass" aria-hidden="true" />
                <p className="text-base font-semibold text-foreground">Solved</p>
                <AttemptReadout outcome={outcome} />
              </Overlay>
            )}
            {outcome && !outcome.solved && (
              <Overlay tone="error">
                <XCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
                <p className="text-base font-semibold text-foreground">Incorrect</p>
                <AttemptReadout outcome={outcome} />
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

        {/* Coach panel: after the attempt settles, teach the puzzle's pattern.
            Suppressed in rush and when the user hides explanations (handled
            inside SolveExplanation). Collapsed by default so it never blocks the
            quick auto-advance, but available to anyone who wants the lesson. */}
        {outcome && puzzle && (
          <div className="mx-auto w-full max-w-[560px]">
            <SolveExplanation
              key={puzzle.id}
              themes={puzzle.themes}
              fen={puzzle.fen}
              solutionMoves={puzzle.moves}
              source={source}
              defaultCollapsed
            />
          </div>
        )}
      </div>
    </BoardSettingsProvider>
  );
}

function AttemptReadout({ outcome }: { outcome: AttemptOutcome }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground" data-testid="attempt-readout">
      <span>
        Puzzle <span className="font-mono font-medium text-foreground">{outcome.puzzleRating}</span>
      </span>
      {outcome.ratingDelta !== null && (
        <span
          className={cn(
            'font-mono font-medium',
            outcome.ratingDelta >= 0 ? 'acc-high' : 'acc-low',
          )}
          data-testid="rating-delta"
        >
          {outcome.ratingDelta >= 0 ? '+' : ''}
          {outcome.ratingDelta}
        </span>
      )}
    </div>
  );
}

function SessionSummary({
  themeLabel,
  solved,
  attempted,
  startAccuracy,
  endAccuracy,
  onTrainMore,
  onChangeTheme,
  onBack,
}: {
  themeLabel: string;
  solved: number;
  attempted: number;
  startAccuracy: number | null;
  endAccuracy: number | null;
  onTrainMore: () => void;
  onChangeTheme?: () => void;
  onBack?: () => void;
}) {
  const sessionAcc = attempted > 0 ? Math.round((solved / attempted) * 100) : 0;
  const fmtAcc = (a: number | null) => (a === null ? '—' : `${Math.round(a * 100)}%`);
  const delta =
    startAccuracy !== null && endAccuracy !== null
      ? Math.round(endAccuracy * 100) - Math.round(startAccuracy * 100)
      : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 text-center" data-testid="session-summary">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl italic tracking-[-0.01em] text-foreground sm:text-3xl">
          Session complete
        </h1>
        <p className="text-sm text-muted-foreground">{themeLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Solved" value={`${solved} / ${attempted}`} />
        <Stat label="Session accuracy" value={`${sessionAcc}%`} />
      </div>

      <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface p-4 text-left">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {themeLabel} accuracy
        </p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Before <span className="font-mono text-foreground">{fmtAcc(startAccuracy)}</span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
          <span className="text-muted-foreground">
            Now <span className="font-mono text-foreground">{fmtAcc(endAccuracy)}</span>
          </span>
          {delta !== null && delta !== 0 && (
            <span
              className={cn('font-mono text-xs font-medium', delta > 0 ? 'acc-high' : 'acc-low')}
              data-testid="accuracy-delta"
            >
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={onTrainMore}
          className="h-11 bg-foreground font-semibold text-background hover:bg-foreground/90"
        >
          Train more
        </Button>
        {onChangeTheme && (
          <Button variant="outline" onClick={onChangeTheme} className="h-10">
            Change theme
          </Button>
        )}
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="h-9 text-muted-foreground">
            Back
          </Button>
        )}
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
      <span className="text-xl font-semibold text-foreground">{value}</span>
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

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, LogIn, RotateCcw, Trophy } from 'lucide-react';
import type { PuzzleDto, RushMode, RushPersonalBestsDto, Square } from '@purechess/shared';
import { Chessboard } from '@/components/board/chessboard';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocalPuzzle } from '@/hooks/use-local-puzzle';
import { RushHud } from '@/components/puzzle/rush-hud';
import { PILL_ACTIVE, PILL_BASE, PILL_INACTIVE } from '@/components/play/pill-styles';
import { finishRush, recordAttempt, startRush } from '@/lib/api/puzzles';

/**
 * Puzzle Rush — the timed board-vision drill. Three phases:
 *   - `pre`:    mode toggle + Start + the user's PB per mode.
 *   - `running`: the assembled set fed into {@link useLocalPuzzle} ONE puzzle at
 *     a time. Correct → +1 score + combo, advance INSTANTLY (speed matters —
 *     no 1.2s delay like the theme trainer). Wrong → strike + red flash,
 *     advance. The run ends on time-out (3min) or 5 strikes (5strikes), or when
 *     the set is exhausted.
 *   - `over`:   final score + PB / new-record celebration + Again / Back.
 *
 * Each solved puzzle ALSO fires `recordAttempt(source:'rush')` fire-and-forget,
 * so rush still feeds the durable puzzle rating + theme stats. The network
 * never blocks the run — a slow/failed POST does not stall the next puzzle.
 */

const CLOCK_MS = 3 * 60 * 1000;
const MAX_STRIKES = 5;
const TICK_MS = 200;
/** Brief red flash on a wrong answer before the instant advance. */
const FLASH_MS = 320;

type Phase = 'pre' | 'running' | 'over';

export interface RushClientProps {
  signedIn: boolean;
  initialBests: RushPersonalBestsDto;
}

export function RushClient({ signedIn, initialBests }: RushClientProps) {
  const [phase, setPhase] = useState<Phase>('pre');
  const [mode, setMode] = useState<RushMode>('3min');
  const [bests, setBests] = useState<RushPersonalBestsDto>(initialBests);
  // Bumped on "Again" to remount RushRun with a fresh fetched set.
  const [runKey, setRunKey] = useState(0);

  if (!signedIn) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="font-display text-3xl italic tracking-[-0.01em] text-foreground">
          Puzzle Rush
        </h1>
        <p className="text-sm text-muted-foreground">
          Race the clock against escalating tactics — the best drill against hanging pieces. Sign in
          to play and track your best.
        </p>
        <Button
          asChild
          className="h-11 bg-foreground font-semibold text-background hover:bg-foreground/90"
        >
          <Link href="/login?return=/puzzles/rush">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Sign in to play
          </Link>
        </Button>
      </div>
    );
  }

  if (phase === 'running') {
    return (
      <RushRun
        key={runKey}
        mode={mode}
        onAgain={() => setRunKey((k) => k + 1)}
        onBack={() => setPhase('pre')}
        onBests={(played) =>
          setBests((prev) => ({
            '3min': mode === '3min' ? played['3min'] : prev['3min'],
            '5strikes': mode === '5strikes' ? played['5strikes'] : prev['5strikes'],
          }))
        }
      />
    );
  }

  return (
    <RushIntro mode={mode} bests={bests} onMode={setMode} onStart={() => setPhase('running')} />
  );
}

/** Pre-run screen: mode toggle, Start, and the user's PB per mode. */
function RushIntro({
  mode,
  bests,
  onMode,
  onStart,
}: {
  mode: RushMode;
  bests: RushPersonalBestsDto;
  onMode: (m: RushMode) => void;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-7 px-4 py-12 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl italic tracking-[-0.01em] text-foreground sm:text-4xl">
          Puzzle Rush
        </h1>
        <p className="text-sm text-muted-foreground">
          Solve as many as you can before the clock — or your fifth miss — runs out.
        </p>
      </div>

      <div className="flex flex-col gap-2.5" role="group" aria-label="Rush mode">
        <ModeOption
          label="3-minute clock"
          hint="Race the clock"
          active={mode === '3min'}
          best={bests['3min']}
          onClick={() => onMode('3min')}
        />
        <ModeOption
          label="5 strikes"
          hint="No clock — five misses ends it"
          active={mode === '5strikes'}
          best={bests['5strikes']}
          onClick={() => onMode('5strikes')}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={onStart}
          className="h-12 bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
          data-testid="rush-start"
        >
          Start
        </Button>
        <Button asChild variant="ghost" className="h-9 text-muted-foreground">
          <Link href="/puzzles/train">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Train
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ModeOption({
  label,
  hint,
  active,
  best,
  onClick,
}: {
  label: string;
  hint: string;
  active: boolean;
  best: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        PILL_BASE,
        'flex items-center justify-between px-4 py-3 text-left',
        active ? PILL_ACTIVE : PILL_INACTIVE,
      )}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-[11px] font-normal opacity-80">{hint}</span>
      </span>
      <span className="flex flex-col items-end gap-0.5">
        <span className="font-mono text-lg font-semibold tabular-nums">{best}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">best</span>
      </span>
    </button>
  );
}

interface RunResult {
  score: number;
  best: number;
  isPB: boolean;
}

/** The active run: feeds the set into useLocalPuzzle one at a time. */
function RushRun({
  mode,
  onAgain,
  onBack,
  onBests,
}: {
  mode: RushMode;
  onAgain: () => void;
  onBack: () => void;
  onBests: (bests: RushPersonalBestsDto) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [puzzles, setPuzzles] = useState<PuzzleDto[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [timeMs, setTimeMs] = useState(CLOCK_MS);
  const [flash, setFlash] = useState<'wrong' | null>(null);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  // Refs the timer/callbacks read so they never go stale.
  const scoreRef = useRef(0);
  const strikesRef = useRef(0);
  const overRef = useRef(false);
  const startedAtRef = useRef<number>(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const puzzlesRef = useRef<PuzzleDto[]>([]);
  // The played mode's authoritative PB, captured when the run ends.
  const bestsRef = useRef<number | null>(null);

  // On unmount (Again remounts, Back returns to pre), hand the PB to the
  // parent so the intro screen reflects it without re-fetching.
  const onBestsRef = useRef(onBests);
  useEffect(() => {
    onBestsRef.current = onBests;
  }, [onBests]);
  useEffect(() => {
    return () => {
      if (bestsRef.current != null) {
        const b: RushPersonalBestsDto = {
          '3min': mode === '3min' ? bestsRef.current : 0,
          '5strikes': mode === '5strikes' ? bestsRef.current : 0,
        };
        onBestsRef.current(b);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Load the assembled set --------------------------------------------
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await startRush(mode);
        if (cancelled) return;
        puzzlesRef.current = res.puzzles;
        setPuzzles(res.puzzles);
        startedAtRef.current = Date.now();
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // --- End the run, record the score, surface the PB ----------------------
  const endRun = useCallback(async () => {
    if (overRef.current) return;
    overRef.current = true;
    setOver(true);
    if (tickRef.current) clearInterval(tickRef.current);

    const finalScore = scoreRef.current;
    const durationMs = Date.now() - startedAtRef.current;
    try {
      const res = await finishRush({ mode, score: finalScore, durationMs });
      setResult({ score: finalScore, best: res.best, isPB: res.isPB });
      // Push the played mode's authoritative PB back to the parent so the
      // pre-run screen shows it without a re-fetch. The other mode is left as
      // a sentinel; the parent merges only the played key.
      bestsRef.current = res.best;
    } catch {
      // Network failed — still show the local score; PB unknown.
      setResult({ score: finalScore, best: finalScore, isPB: false });
    }
  }, [mode]);

  // --- The 3-minute clock (3min mode only) --------------------------------
  useEffect(() => {
    if (loading || mode !== '3min') return;
    startedAtRef.current = Date.now();
    tickRef.current = setInterval(() => {
      const remaining = CLOCK_MS - (Date.now() - startedAtRef.current);
      if (remaining <= 0) {
        setTimeMs(0);
        void endRun();
      } else {
        setTimeMs(remaining);
      }
    }, TICK_MS);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [loading, mode, endRun]);

  // Advance to the next puzzle, or end the run if the set is exhausted.
  const advance = useCallback(() => {
    setIndex((i) => {
      const next = i + 1;
      if (next >= puzzlesRef.current.length) {
        void endRun();
        return i;
      }
      return next;
    });
  }, [endRun]);

  const current = puzzles[index] ?? null;

  // --- Per-puzzle outcomes ------------------------------------------------
  const handleSolved = useCallback(
    ({ msToSolve }: { msToSolve: number }) => {
      if (overRef.current) return;
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setCombo((c) => c + 1);
      // Fire-and-forget: rush solves still feed the durable rating + stats.
      const solved = puzzlesRef.current[index];
      if (solved) {
        void recordAttempt(solved.id, { solved: true, msToSolve, source: 'rush' }).catch(() => {});
      }
      advance();
    },
    [advance, index],
  );

  const handleFailed = useCallback(() => {
    if (overRef.current) return;
    setCombo(0);
    strikesRef.current += 1;
    setStrikes(strikesRef.current);

    // Red flash, then instant advance.
    setFlash('wrong');
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), FLASH_MS);

    const missed = puzzlesRef.current[index];
    if (missed) {
      void recordAttempt(missed.id, { solved: false, source: 'rush' }).catch(() => {});
    }

    if (mode === '5strikes' && strikesRef.current >= MAX_STRIKES) {
      void endRun();
      return;
    }
    advance();
  }, [advance, endRun, index, mode]);

  const { state, onMove } = useLocalPuzzle({
    puzzle: over ? null : current,
    onSolved: handleSolved,
    onFailed: handleFailed,
  });

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  if (over) {
    return <RushSummary mode={mode} result={result} onAgain={onAgain} onBack={onBack} />;
  }

  if (loadError) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <p className="text-sm text-destructive">Could not start the run.</p>
        <Button variant="outline" onClick={onBack} className="h-9">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <BoardSettingsProvider>
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 py-6">
        <RushHud mode={mode} timeMs={timeMs} strikes={strikes} score={score} combo={combo} />

        <div
          className={cn(
            'relative w-full rounded-[6px] transition-shadow duration-150',
            flash === 'wrong' && 'shadow-[0_0_0_3px_hsl(var(--destructive)/0.7)]',
          )}
          data-flash={flash ?? undefined}
        >
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

          {loading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center rounded-[4px] bg-background/60 backdrop-blur-sm">
              <Loader2 className="h-7 w-7 animate-spin text-brass" aria-label="Loading run" />
            </div>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {state.phase === 'player' ? (
            <>
              Best move for{' '}
              <span className="font-medium text-foreground">
                {state.solvingColor === 'w' ? 'White' : 'Black'}
              </span>
              .
            </>
          ) : (
            ' '
          )}
        </p>

        <Button
          variant="ghost"
          onClick={() => void endRun()}
          className="mx-auto h-8 text-xs text-muted-foreground"
          data-testid="rush-end"
        >
          End run
        </Button>
      </div>
    </BoardSettingsProvider>
  );
}

/** Post-run screen: final score, PB / new-record celebration, Again / Back. */
function RushSummary({
  mode,
  result,
  onAgain,
  onBack,
}: {
  mode: RushMode;
  result: RunResult | null;
  onAgain: () => void;
  onBack: () => void;
}) {
  const score = result?.score ?? 0;
  const best = result?.best ?? score;
  const isPB = result?.isPB ?? false;
  const modeLabel = mode === '3min' ? '3-minute' : '5 strikes';

  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col gap-7 px-4 py-12 text-center"
      data-testid="rush-summary"
    >
      <div className="flex flex-col items-center gap-2">
        {isPB ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-brass/50 bg-brass/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-brass-text"
            data-testid="rush-pb-badge"
          >
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            New record
          </span>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {modeLabel} rush
          </span>
        )}
        <h1
          className={cn(
            'font-display text-2xl italic tracking-[-0.01em] sm:text-3xl',
            isPB ? 'text-brass' : 'text-foreground',
          )}
        >
          {isPB ? 'A new best.' : 'Run complete.'}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Score" value={String(score)} accent />
        <Stat label="Personal best" value={String(best)} />
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={onAgain}
          className="h-12 bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
          data-testid="rush-again"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Again
        </Button>
        <Button onClick={onBack} variant="ghost" className="h-9 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Train
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-border bg-surface p-4">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          'font-mono text-3xl font-semibold tabular-nums',
          accent ? 'text-brass' : 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

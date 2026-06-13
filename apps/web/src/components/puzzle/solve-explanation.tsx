'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Lightbulb, RotateCcw, X } from 'lucide-react';
import type { PuzzleSource, Square } from '@purechess/shared';
import { Chessboard } from '@/components/board/chessboard';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings-store';
import { applyUci, solvingColorFromFen, uciToIntent } from '@/lib/board/puzzle-utils';
import { bestMoveArrow, type BoardShape } from '@/lib/board/annotations';
import { explainThemes, type ThemeExplanation } from '@/lib/board/theme-explanations';

/**
 * The post-solve coach panel. After a puzzle is solved (or revealed), it teaches
 * the PATTERN, not just the move:
 *   1. The theme(s): name + one-liner + "what to look for".
 *   2. "Why it works": a mini-board you can step through the solution on, with
 *      the key motif arrow drawn on the starting position (the existing
 *      annotation-arrow support — `bestMoveArrow` → `autoShapes`).
 *
 * It NEVER renders in rush (rush is a speed mode — no teaching mid-streak) and
 * obeys the `hideExplanations` user preference; both make the component return
 * null. In theme/review/daily it is collapsible and dismissible.
 *
 * All copy is static and hand-written (`theme-explanations.ts`); there is no
 * generation here.
 */

export interface SolveExplanationProps {
  /** The solved puzzle's theme slugs (lichess vocabulary). */
  themes: readonly string[] | null | undefined;
  /** The puzzle's starting FEN (position the solver faced). */
  fen: string;
  /**
   * The solution line in UCI, solver-first (the DB-puzzle convention:
   * `moves[0]` is the solver's first move). Drives the steppable mini-board and
   * the key-motif arrow.
   */
  solutionMoves: readonly string[];
  /** Which mode surfaced this — rush suppresses the panel entirely. */
  source: PuzzleSource;
  /** Dismiss the panel (theme/review/daily). */
  onDismiss?: () => void;
  /** Start collapsed (e.g. during a fast auto-advancing session). */
  defaultCollapsed?: boolean;
}

export function SolveExplanation({
  themes,
  fen,
  solutionMoves,
  source,
  onDismiss,
  defaultCollapsed = false,
}: SolveExplanationProps) {
  const hideExplanations = useSettingsStore((s) => s.hideExplanations);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const explanations = useMemo(() => explainThemes(themes), [themes]);

  // Rush never coaches mid-streak; the hide preference opts out everywhere.
  if (source === 'rush' || hideExplanations) return null;
  // Nothing to teach (no recognized theme AND no line) — stay out of the way.
  if (explanations.length === 0 && solutionMoves.length === 0) return null;

  return (
    <section
      className="flex w-full flex-col gap-3 rounded-[10px] border border-border bg-surface p-4"
      data-testid="solve-explanation"
      aria-label="Pattern explanation"
    >
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex items-center gap-2 text-left"
        >
          <Lightbulb className="h-4 w-4 text-brass" aria-hidden="true" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            The pattern
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground/70 transition-transform',
              collapsed && '-rotate-90',
            )}
            aria-hidden="true"
          />
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss explanation"
            className="rounded-md p-1 text-muted-foreground/70 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </header>

      {!collapsed && (
        <div className="flex flex-col gap-4">
          {explanations.length > 0 && (
            <ul className="flex flex-col gap-3" data-testid="theme-explanations">
              {explanations.map((ex) => (
                <ThemeCopy key={ex.name} ex={ex} />
              ))}
            </ul>
          )}

          {solutionMoves.length > 0 && (
            <WhyItWorks fen={fen} solutionMoves={solutionMoves} />
          )}
        </div>
      )}
    </section>
  );
}

function ThemeCopy({ ex }: { ex: ThemeExplanation }) {
  return (
    <li className="flex flex-col gap-1" data-testid="theme-copy">
      <p className="text-sm font-semibold text-foreground">{ex.name}</p>
      {ex.oneLiner && <p className="text-sm text-muted-foreground">{ex.oneLiner}</p>}
      {ex.whatToLookFor && (
        <p className="text-xs text-muted-foreground/85">
          <span className="font-medium text-foreground/80">Look for: </span>
          {ex.whatToLookFor}
        </p>
      )}
    </li>
  );
}

/**
 * The "why it works" mini-board. Starts at the puzzle FEN with the key motif
 * arrow (the solver's first move) drawn, and steps forward/back through the
 * solution line. Read-only — clicking the move list (or the arrows) drives it.
 */
function WhyItWorks({
  fen,
  solutionMoves,
}: {
  fen: string;
  solutionMoves: readonly string[];
}) {
  // Precompute the FEN after each move so stepping is O(1) and never re-derives.
  const frames = useMemo(() => buildFrames(fen, solutionMoves), [fen, solutionMoves]);
  // ply 0 = start position; ply N = after the Nth solution move.
  const [ply, setPly] = useState(0);

  const frame = frames[Math.min(ply, frames.length - 1)];
  const orientation = solvingColorFromFen(fen) === 'w' ? 'white' : 'black';

  // The key motif: the solver's first move, drawn as a green arrow on the start
  // position only (once the user steps in, the board shows the real moves).
  const keyArrow: BoardShape[] = useMemo(() => {
    if (ply !== 0) return [];
    const arrow = bestMoveArrow(solutionMoves[0], 'green');
    return arrow ? [arrow] : [];
  }, [ply, solutionMoves]);

  const atStart = ply === 0;
  const atEnd = ply >= frames.length - 1;

  return (
    <div className="flex flex-col gap-2.5" data-testid="why-it-works">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Why it works
      </p>

      <BoardSettingsProvider>
        <div className="mx-auto w-full max-w-[280px]">
          <Chessboard
            position={frame.fen}
            orientation={orientation}
            readOnly
            autoShapes={keyArrow}
            lastMove={frame.lastMove ?? undefined}
          />
        </div>
      </BoardSettingsProvider>

      {/* Clickable solution line — each move jumps the mini-board to that ply. */}
      <ol className="flex flex-wrap items-center gap-1.5" data-testid="solution-line">
        {solutionMoves.map((uci, i) => {
          const targetPly = i + 1;
          const active = ply === targetPly;
          return (
            <li key={`${uci}-${i}`}>
              <button
                type="button"
                onClick={() => setPly(targetPly)}
                aria-pressed={active}
                aria-label={`Go to move ${i + 1}, ${formatUci(uci)}`}
                className={cn(
                  'rounded-md px-1.5 py-0.5 font-mono text-xs transition-colors',
                  active
                    ? 'bg-brass/20 text-brass-text'
                    : 'text-muted-foreground hover:bg-raised hover:text-foreground',
                )}
              >
                {formatUci(uci)}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => setPly((p) => Math.max(0, p - 1))}
          disabled={atStart}
          aria-label="Previous move"
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          onClick={() => setPly((p) => Math.min(frames.length - 1, p + 1))}
          disabled={atEnd}
          aria-label="Next move"
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          onClick={() => setPly(0)}
          disabled={atStart}
          aria-label="Reset to start"
          className="h-8 px-2 text-xs text-muted-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Start
        </Button>
      </div>
    </div>
  );
}

interface Frame {
  fen: string;
  lastMove: { from: Square; to: Square } | null;
}

/**
 * Build the FEN at each ply: frame 0 is the start; frame i applies the first i
 * solution moves. Stops early if a move can't be applied (defensive — bad data
 * shouldn't crash the panel).
 */
function buildFrames(startFen: string, moves: readonly string[]): Frame[] {
  const frames: Frame[] = [{ fen: startFen, lastMove: null }];
  let fen = startFen;
  for (const uci of moves) {
    const applied = applyUci(fen, uci);
    if (!applied) break;
    fen = applied.fen;
    frames.push({
      fen,
      lastMove: { from: applied.lastMove[0] as Square, to: applied.lastMove[1] as Square },
    });
  }
  return frames;
}

/** "e2e4" → "e2-e4", "e7e8q" → "e7-e8=Q" (display only). */
function formatUci(uci: string): string {
  const intent = uciToIntent(uci);
  const promo = intent.promotion ? `=${intent.promotion.toUpperCase()}` : '';
  return `${intent.from}-${intent.to}${promo}`;
}

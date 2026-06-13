'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { DrillLineDto, MoveIntent, RepertoireColorDto } from '@purechess/shared';
import { applyMoveToFen } from '@/lib/board/rules';
import { applyUci, solvingColorFromFen, uciMatch } from '@/lib/board/puzzle-utils';

/**
 * Drives the opening trainer's state machine over a queued set of lines.
 *
 * Walks one line at a time. On each ply the mover is derived from the FEN's
 * active color: the NOT-user-color plies auto-play (the opponent's booked
 * reply); on user-color plies the machine waits for input.
 *
 *  - A correct booked move advances to the next ply (auto-playing the opponent
 *    reply, or completing the line at a leaf).
 *  - A DIFFERENT legal move is "out of book": it counts as a miss for grading
 *    and the booked move is offered (the component draws the arrow), but the
 *    line still advances along the BOOKED move so the drill keeps its shape.
 *  - An illegal move is rejected outright (no advance, no miss).
 *
 * At a line's leaf the line completes: `correctFirstTry` is true only when no
 * user move in that line was missed. The caller grades it, then the machine
 * advances to the next line. When the last line completes the session ends and
 * `summary` is populated.
 *
 * Pure move math is reused from `puzzle-utils` (`applyUci`, `uciMatch`,
 * `solvingColorFromFen`) and `rules` (`applyMoveToFen` for legality) — no fork.
 */

export interface DrillLineResult {
  nodePath: string;
  /** True when every user move in the line was correct on the first try. */
  correctFirstTry: boolean;
  /** Number of user moves the user got wrong (out of book). */
  misses: number;
}

export interface DrillSummary {
  /** Per-line outcomes, in the order they were drilled. */
  results: DrillLineResult[];
  linesTrained: number;
  /** Share of user moves answered correctly on the first try, 0..1. */
  firstTryRate: number;
}

export type DrillPhase =
  | 'idle'
  | 'opponent' // an opponent reply is being auto-played
  | 'awaiting' // waiting for the user's booked move
  | 'done'; // every line drilled

export interface DrillState {
  phase: DrillPhase;
  /** Current position FEN. */
  fen: string;
  /** Board orientation / the side the user plays. */
  color: RepertoireColorDto;
  /** [from, to] of the last move played, for board highlighting. */
  lastMove: [string, string] | null;
  /** 1-based index of the line being drilled. */
  lineNumber: number;
  totalLines: number;
  /** 1-based index of the current ply within the line (the move about to be made). */
  moveNumber: number;
  /** Total plies in the current line. */
  lineLength: number;
  /** When out of book, the booked move's UCI to surface (arrow); else null. */
  bookMove: string | null;
  /** Filled once every line is drilled. */
  summary: DrillSummary | null;
}

function userColorChar(color: RepertoireColorDto): 'w' | 'b' {
  return color === 'white' ? 'w' : 'b';
}

/** Whether the side to move at `fen` is the user's color. */
function isUserTurn(fen: string, color: RepertoireColorDto): boolean {
  return solvingColorFromFen(fen) === userColorChar(color);
}

export interface UseOpeningDrillArgs {
  lines: DrillLineDto[];
  color: RepertoireColorDto;
  /** Called when a line finishes; the caller persists the grade. */
  onGradeLine?: (result: DrillLineResult) => void;
  /** Called once when every line has been drilled. */
  onComplete?: (summary: DrillSummary) => void;
}

interface Internal {
  lineIdx: number;
  stepIdx: number; // index into the current line's steps[] of the NEXT move
  misses: number;
  fen: string;
  lastMove: [string, string] | null;
}

export function useOpeningDrill({
  lines,
  color,
  onGradeLine,
  onComplete,
}: UseOpeningDrillArgs) {
  const acc = useRef<{ results: DrillLineResult[] }>({ results: [] });

  // The first drillable line (a non-empty set). Empty queue → done on start().
  const initial = useMemo<Internal>(() => seedLine(lines, 0), [lines]);

  const [state, setState] = useState<DrillState>(() =>
    buildState(lines, color, initial, null, []),
  );

  // Ref mirror so callbacks see the latest internal cursor without re-binding.
  // The ref is the source of truth once `start` runs.
  const internalRef = useRef<Internal>(initial);

  /**
   * Advance from `cur` until either the user must move (phase 'awaiting'), the
   * line completes (grade + roll to next line), or the queue is exhausted.
   * Auto-plays every opponent ply along the way.
   */
  const drive = useCallback(
    (cur: Internal, bookMove: string | null) => {
      let working = cur;

      // Auto-play opponent plies until it's the user's turn or the queue ends.
      // Each loop iteration either: finishes the session, completes+grades a
      // line and rolls to the next, parks awaiting the user, or auto-plays one
      // opponent ply.
      for (;;) {
        const line = lines[working.lineIdx];
        if (!line) {
          // Queue exhausted — emit the summary.
          const summary = summarize(acc.current.results);
          internalRef.current = { ...working, lineIdx: lines.length };
          setState((prev) => ({ ...prev, phase: 'done', summary }));
          onComplete?.(summary);
          return;
        }

        const atLeaf = working.stepIdx >= line.steps.length;
        if (atLeaf) {
          // Line complete: grade it, then advance to the next line.
          const result: DrillLineResult = {
            nodePath: line.nodePath,
            correctFirstTry: working.misses === 0,
            misses: working.misses,
          };
          acc.current.results.push(result);
          onGradeLine?.(result);

          working = seedLine(lines, working.lineIdx + 1);
          internalRef.current = working;
          // Loop continues: the next iteration handles the new line (or done).
          bookMove = null;
          continue;
        }

        if (isUserTurn(working.fen, color)) {
          internalRef.current = working;
          setState(buildState(lines, color, working, bookMove, acc.current.results, 'awaiting'));
          return;
        }

        // Opponent ply: auto-play the booked move.
        const step = line.steps[working.stepIdx];
        const applied = applyUci(working.fen, step.uci);
        working = {
          ...working,
          stepIdx: working.stepIdx + 1,
          fen: applied?.fen ?? step.fen,
          lastMove: applied?.lastMove ?? null,
        };
        bookMove = null;
      }
    },
    [lines, color, onGradeLine, onComplete],
  );

  /** Kick the machine: auto-play any leading opponent plies of the first line. */
  const start = useCallback(() => {
    acc.current = { results: [] };
    const seed = seedLine(lines, 0);
    internalRef.current = seed;
    if (lines.length === 0) {
      const summary = summarize([]);
      setState((prev) => ({ ...prev, phase: 'done', summary }));
      onComplete?.(summary);
      return;
    }
    drive(seed, null);
  }, [lines, drive, onComplete]);

  /** Handle a user board move (a MoveIntent from the Chessboard). */
  const onMove = useCallback(
    (intent: MoveIntent) => {
      const cur = internalRef.current;
      const line = lines[cur.lineIdx];
      if (!line || cur.stepIdx >= line.steps.length) return;
      if (!isUserTurn(cur.fen, color)) return;
      if (!intent.from || !intent.to) return;

      const playedUci =
        intent.from + intent.to + (intent.promotion ? intent.promotion : '');
      const step = line.steps[cur.stepIdx];

      // Correct booked move → advance (no miss).
      if (uciMatch(playedUci, step.uci)) {
        const applied = applyUci(cur.fen, step.uci);
        const next: Internal = {
          ...cur,
          stepIdx: cur.stepIdx + 1,
          fen: applied?.fen ?? step.fen,
          lastMove: applied?.lastMove ?? null,
        };
        drive(next, null);
        return;
      }

      // Different move: only react if it's actually legal (reject illegal input).
      const legalFen = applyMoveToFen(cur.fen, intent);
      if (!legalFen) return;

      // Out of book: count a miss, then advance along the BOOKED move and
      // surface the book move so the component can draw the correction arrow.
      const applied = applyUci(cur.fen, step.uci);
      const next: Internal = {
        ...cur,
        stepIdx: cur.stepIdx + 1,
        misses: cur.misses + 1,
        fen: applied?.fen ?? step.fen,
        lastMove: applied?.lastMove ?? null,
      };
      drive(next, step.uci);
    },
    [lines, color, drive],
  );

  return { state, start, onMove };
}

// --- helpers ---------------------------------------------------------------

/** Seed the internal cursor at the start of line `idx` (rootFen, step 0). */
function seedLine(lines: DrillLineDto[], idx: number): Internal {
  const line = lines[idx];
  return {
    lineIdx: idx,
    stepIdx: 0,
    misses: 0,
    fen: line ? line.rootFen : (lines[0]?.rootFen ?? ''),
    lastMove: null,
  };
}

function buildState(
  lines: DrillLineDto[],
  color: RepertoireColorDto,
  cur: Internal,
  bookMove: string | null,
  results: DrillLineResult[],
  phaseOverride?: DrillPhase,
): DrillState {
  const line = lines[cur.lineIdx];
  const lineLength = line ? line.steps.length : 0;
  let phase: DrillPhase = phaseOverride ?? 'idle';
  if (!phaseOverride && line) {
    phase = isUserTurn(cur.fen, color) ? 'awaiting' : 'opponent';
  }
  return {
    phase,
    fen: cur.fen,
    color,
    lastMove: cur.lastMove,
    lineNumber: Math.min(cur.lineIdx + 1, lines.length || 1),
    totalLines: lines.length,
    moveNumber: Math.min(cur.stepIdx + 1, lineLength || 1),
    lineLength,
    bookMove,
    summary: null,
  };
}

function summarize(results: DrillLineResult[]): DrillSummary {
  const linesTrained = results.length;
  const firstTry = results.filter((r) => r.correctFirstTry).length;
  return {
    results,
    linesTrained,
    firstTryRate: linesTrained === 0 ? 0 : firstTry / linesTrained,
  };
}

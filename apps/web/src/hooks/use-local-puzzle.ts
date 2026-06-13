'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Color, PuzzleDto } from '@purechess/shared';
import { soundEngine } from '@/lib/board/sound';
import { applyUci, solvingColorFromFen, uciMatch } from '@/lib/board/puzzle-utils';

/**
 * Solve-state machine for DB-backed puzzles (the local puzzle bank). Unlike the
 * daily lichess puzzle there is NO game PGN / initialPly and NO "setup" phase:
 *   - `puzzle.fen` IS the position the solver faces.
 *   - `puzzle.moves[0]` is the solver's FIRST move (not an opponent setup move).
 *   - `solvingColor` is the FEN active-color field.
 *   - even indices are the solver's moves, odd indices the scripted reply.
 *
 * Phases: player -> auto-reply -> player -> ... -> success | fail -> reveal.
 *
 * This hook is the reusable solve core: rush (S05), review (S06), and mistakes
 * (S07) all render the same Chessboard against this machine. It tracks
 * `msToSolve` from the first player move to the solve so callers can report it.
 */

export type LocalPuzzlePhase =
  | 'idle'
  | 'player'
  | 'auto-reply'
  | 'success'
  | 'fail'
  | 'reveal';

export interface LocalPuzzleState {
  phase: LocalPuzzlePhase;
  fen: string;
  solvingColor: Color;
  lastMove: [string, string] | null;
  /** Index into `puzzle.moves` of the next expected move. */
  moveIndex: number;
}

export interface UseLocalPuzzleArgs {
  puzzle: PuzzleDto | null;
  /** Fired once when the puzzle is fully solved; carries ms from first move. */
  onSolved?: (info: { msToSolve: number }) => void;
  /** Fired once on the first wrong move. */
  onFailed?: () => void;
}

export interface UseLocalPuzzleReturn {
  state: LocalPuzzleState;
  /** Submit the solver's move in UCI ("e2e4", "e7e8q"). */
  onMove: (uci: string) => void;
  /** From a `fail`, step the rest of the solution onto the board. */
  onReveal: () => void;
}

const AUTO_REPLY_MS = 500;
const REVEAL_MS = 800;

const EMPTY_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const IDLE_STATE: LocalPuzzleState = {
  phase: 'idle',
  fen: EMPTY_FEN,
  solvingColor: 'w',
  lastMove: null,
  moveIndex: 0,
};

export function useLocalPuzzle({
  puzzle,
  onSolved,
  onFailed,
}: UseLocalPuzzleArgs): UseLocalPuzzleReturn {
  const [state, setState] = useState<LocalPuzzleState>(IDLE_STATE);

  // The puzzle's immutable solution line; null while idle.
  const movesRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Wall-clock of the first player move; null until the solver moves.
  const startedAtRef = useRef<number | null>(null);
  // Guards so onSolved/onFailed fire at most once per puzzle.
  const settledRef = useRef(false);
  // Latest snapshot for timer/callback closures (one render behind, safe).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Keep the latest callbacks without re-binding move handlers each render.
  const onSolvedRef = useRef(onSolved);
  const onFailedRef = useRef(onFailed);
  useEffect(() => {
    onSolvedRef.current = onSolved;
    onFailedRef.current = onFailed;
  }, [onSolved, onFailed]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // (Re)initialize the machine whenever the puzzle identity changes. The FEN is
  // the start; the solver is to move (no setup ply to animate).
  useEffect(() => {
    clearTimer();
    startedAtRef.current = null;
    settledRef.current = false;
    if (!puzzle) {
      movesRef.current = [];
      setState(IDLE_STATE);
      return;
    }
    movesRef.current = puzzle.moves;
    setState({
      phase: 'player',
      fen: puzzle.fen,
      solvingColor: solvingColorFromFen(puzzle.fen),
      lastMove: null,
      moveIndex: 0,
    });
    return clearTimer;
    // Re-run only on a new puzzle (id is the identity key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle?.id]);

  const settleSolved = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    const started = startedAtRef.current;
    const msToSolve = started === null ? 0 : Math.max(0, Date.now() - started);
    onSolvedRef.current?.({ msToSolve });
  }, []);

  // auto-reply -> player | success: play the opponent's scripted response.
  const runAutoReply = useCallback(
    (fen: string, index: number) => {
      const moves = movesRef.current;
      clearTimer();
      timerRef.current = setTimeout(() => {
        const applied = applyUci(fen, moves[index]);
        if (!applied) {
          setState((s) => ({ ...s, phase: 'player' }));
          return;
        }
        const newIndex = index + 1;
        const done = newIndex >= moves.length;
        if (done) {
          soundEngine.play('success');
          settleSolved();
        }
        setState((s) => ({
          ...s,
          phase: done ? 'success' : 'player',
          fen: applied.fen,
          lastMove: applied.lastMove,
          moveIndex: newIndex,
        }));
      }, AUTO_REPLY_MS);
    },
    [clearTimer, settleSolved],
  );

  // reveal: step through the remaining solution, one move every REVEAL_MS.
  const runReveal = useCallback(
    (fen: string, index: number) => {
      const moves = movesRef.current;
      if (index >= moves.length) return;
      clearTimer();
      timerRef.current = setTimeout(() => {
        const applied = applyUci(fen, moves[index]);
        if (!applied) return;
        const newIndex = index + 1;
        setState((s) => ({
          ...s,
          phase: 'reveal',
          fen: applied.fen,
          lastMove: applied.lastMove,
          moveIndex: newIndex,
        }));
        runReveal(applied.fen, newIndex);
      }, REVEAL_MS);
    },
    [clearTimer],
  );

  const onMove = useCallback(
    (uci: string) => {
      const s = stateRef.current;
      const moves = movesRef.current;
      if (s.phase !== 'player' || s.moveIndex >= moves.length) return;

      // Start the timer on the first player move of the puzzle.
      if (startedAtRef.current === null) startedAtRef.current = Date.now();

      if (!uciMatch(uci, moves[s.moveIndex])) {
        soundEngine.play('error');
        if (!settledRef.current) {
          settledRef.current = true;
          onFailedRef.current?.();
        }
        setState((prev) => ({ ...prev, phase: 'fail' }));
        return;
      }

      const applied = applyUci(s.fen, uci);
      if (!applied) return;
      const newIndex = s.moveIndex + 1;

      if (newIndex >= moves.length) {
        soundEngine.play('success');
        settleSolved();
        setState((prev) => ({
          ...prev,
          phase: 'success',
          fen: applied.fen,
          lastMove: applied.lastMove,
          moveIndex: newIndex,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        phase: 'auto-reply',
        fen: applied.fen,
        lastMove: applied.lastMove,
        moveIndex: newIndex,
      }));
      runAutoReply(applied.fen, newIndex);
    },
    [runAutoReply, settleSolved],
  );

  const onReveal = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'fail') return;
    setState((prev) => ({ ...prev, phase: 'reveal' }));
    runReveal(s.fen, s.moveIndex);
  }, [runReveal]);

  // Clear any pending timer on unmount.
  useEffect(() => clearTimer, [clearTimer]);

  return { state, onMove, onReveal };
}

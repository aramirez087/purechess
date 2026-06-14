'use client';

import { useCallback, useRef } from 'react';
import type React from 'react';
import { soundEngine } from '@/lib/board/sound';
import { applyUci, uciMatch } from '@/lib/board/puzzle-utils';

export const AUTO_REPLY_MS = 500;
export const REVEAL_MS = 800;

/** Minimal state shape the core reads from stateRef. */
export interface PuzzleMoveState {
  phase: string;
  fen: string;
  moveIndex: number;
}

export interface UsePuzzleCoreReturn {
  timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  clearTimer: () => void;
  runAutoReply: (fen: string, index: number) => void;
  runReveal: (fen: string, index: number) => void;
  /**
   * Shared onMove body: uciMatch → error/fail, applyUci → success/auto-reply.
   * Returns 'wrong' | 'done' | 'applied' | 'noop' so callers can add
   * hook-specific side effects (settledRef, onFailed, startedAt).
   */
  applyPlayerMoveStep: (uci: string) => 'wrong' | 'done' | 'applied' | 'noop';
  onReveal: () => void;
}

/**
 * Shared timer + state-machine core for the puzzle solve loop.
 * Eliminates the runReveal / runAutoReply / onMove duplication between
 * use-local-puzzle (DB puzzles) and use-puzzle (daily lichess puzzle).
 *
 * @param stateRef          - ref to current hook state (read inside timer callbacks)
 * @param setState          - React setState updater (stable across renders)
 * @param solutionRef       - ref to the current puzzle solution array ([] while idle)
 * @param onSolvedFiredRef  - optional ref to a callback fired when the puzzle is
 *                           solved; use-local-puzzle passes settleSolved here
 */
export function usePuzzleCore(
  stateRef: React.MutableRefObject<PuzzleMoveState>,
  setState: (fn: (s: any) => any) => void,
  solutionRef: React.MutableRefObject<string[]>,
  onSolvedFiredRef?: React.MutableRefObject<(() => void) | undefined>,
): UsePuzzleCoreReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runReveal = useCallback(
    (fen: string, index: number) => {
      const moves = solutionRef.current;
      if (index >= moves.length) return;
      clearTimer();
      timerRef.current = setTimeout(() => {
        const m = solutionRef.current;
        const applied = applyUci(fen, m[index]);
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
    // solutionRef is a stable MutableRefObject — intentionally excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearTimer, setState],
  );

  const runAutoReply = useCallback(
    (fen: string, index: number) => {
      const moves = solutionRef.current;
      if (!moves.length) return;
      clearTimer();
      timerRef.current = setTimeout(() => {
        const m = solutionRef.current;
        const applied = applyUci(fen, m[index]);
        if (!applied) {
          setState((s) => ({ ...s, phase: 'player' }));
          return;
        }
        const newIndex = index + 1;
        const done = newIndex >= m.length;
        if (done) {
          soundEngine.play('success');
          onSolvedFiredRef?.current?.();
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
    // solutionRef and onSolvedFiredRef are stable MutableRefObjects — excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearTimer, setState],
  );

  const applyPlayerMoveStep = useCallback(
    (uci: string): 'wrong' | 'done' | 'applied' | 'noop' => {
      const moves = solutionRef.current;
      const s = stateRef.current;
      if (s.phase !== 'player' || s.moveIndex >= moves.length) return 'noop';

      if (!uciMatch(uci, moves[s.moveIndex])) {
        soundEngine.play('error');
        setState((prev) => ({ ...prev, phase: 'fail' }));
        return 'wrong';
      }

      const applied = applyUci(s.fen, uci);
      if (!applied) return 'noop';
      const newIndex = s.moveIndex + 1;

      if (newIndex >= moves.length) {
        soundEngine.play('success');
        onSolvedFiredRef?.current?.();
        setState((prev) => ({
          ...prev,
          phase: 'success',
          fen: applied.fen,
          lastMove: applied.lastMove,
          moveIndex: newIndex,
        }));
        return 'done';
      }

      setState((prev) => ({
        ...prev,
        phase: 'auto-reply',
        fen: applied.fen,
        lastMove: applied.lastMove,
        moveIndex: newIndex,
      }));
      runAutoReply(applied.fen, newIndex);
      return 'applied';
    },
    // solutionRef, stateRef, onSolvedFiredRef are stable MutableRefObjects — excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setState, runAutoReply],
  );

  const onReveal = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'fail') return;
    setState((prev) => ({ ...prev, phase: 'reveal' }));
    runReveal(s.fen, s.moveIndex);
    // stateRef is a stable MutableRefObject — intentionally excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setState, runReveal]);

  return { timerRef, clearTimer, runAutoReply, runReveal, applyPlayerMoveStep, onReveal };
}

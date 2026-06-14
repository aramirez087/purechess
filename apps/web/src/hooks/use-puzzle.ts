'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Color } from '@purechess/shared';
import {
  replayPgnVerbose,
} from '@/lib/board/puzzle-utils';
import { getDailyPuzzle, type LichessPuzzleData } from '@/lib/api/puzzles';
import { usePuzzleCore } from '@/hooks/use-puzzle-core';

export type PuzzlePhase =
  | 'loading'
  | 'setup'
  | 'player'
  | 'auto-reply'
  | 'success'
  | 'fail'
  | 'reveal';

export interface PuzzleState {
  phase: PuzzlePhase;
  fen: string;
  solvingColor: Color;
  lastMove: [string, string] | null;
  moveIndex: number;
  error: string | null;
}

export interface UsePuzzleReturn {
  state: PuzzleState;
  puzzleData: LichessPuzzleData | null;
  onMove: (uci: string) => void;
  onReveal: () => void;
  onNext: () => void;
  onTryAgain: () => void;
}

/** Static derivation from a loaded puzzle — never changes once set. */
interface PuzzleContext {
  /** Position the solver faces (after the setup move). */
  puzzleFen: string;
  /** One ply earlier — where the `setup` animation starts. */
  preSetupFen: string;
  /** The last opponent move, animated during `setup`. */
  setupMove: [string, string];
  solvingColor: Color;
  solution: string[];
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const SETUP_MS = 600;

const INITIAL_STATE: PuzzleState = {
  phase: 'loading',
  fen: START_FEN,
  solvingColor: 'w',
  lastMove: null,
  moveIndex: 0,
  error: null,
};

function buildContext(data: LichessPuzzleData): PuzzleContext | null {
  const { initialPly, solution } = data.puzzle;
  if (!solution || solution.length === 0 || initialPly < 0) return null;

  const plies = replayPgnVerbose(data.game.pgn);
  // Lichess's `initialPly` is the 0-based index of the game's last move (the
  // setup move). The puzzle position is the FEN *after* that move, where the
  // solver is to move. We need that move to exist in the replayed line.
  if (!plies || plies.length <= initialPly) return null;

  const setup = plies[initialPly];
  const puzzleFen = setup.fenAfter;
  const preSetupFen = initialPly >= 1 ? plies[initialPly - 1].fenAfter : START_FEN;
  const solvingColor = (puzzleFen.split(' ')[1] as Color) ?? 'w';

  return {
    puzzleFen,
    preSetupFen,
    setupMove: [setup.from, setup.to],
    solvingColor,
    solution,
  };
}

export function usePuzzle(): UsePuzzleReturn {
  const [state, setState] = useState<PuzzleState>(INITIAL_STATE);
  const [puzzleData, setPuzzleData] = useState<LichessPuzzleData | null>(null);

  const ctxRef = useRef<PuzzleContext | null>(null);
  // Mirrors `state` so timer/callback closures read the latest snapshot without
  // re-binding. One render behind, which is safe: the relevant fields only
  // change at transitions the user can't outrace.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Keep solutionRef in sync each render so the core always sees the latest solution.
  const solutionRef = useRef<string[]>([]);
  solutionRef.current = ctxRef.current?.solution ?? [];

  const { timerRef, clearTimer, applyPlayerMoveStep, onReveal } = usePuzzleCore(
    stateRef,
    setState,
    solutionRef,
  );

  // setup → player: show the pre-setup board, animate the last opponent move
  // after a beat, then hand control to the solver.
  const beginSetup = useCallback(
    (ctx: PuzzleContext) => {
      clearTimer();
      setState({
        phase: 'setup',
        fen: ctx.preSetupFen,
        solvingColor: ctx.solvingColor,
        lastMove: null,
        moveIndex: 0,
        error: null,
      });
      timerRef.current = setTimeout(() => {
        setState({
          phase: 'player',
          fen: ctx.puzzleFen,
          solvingColor: ctx.solvingColor,
          lastMove: ctx.setupMove,
          moveIndex: 0,
          error: null,
        });
      }, SETUP_MS);
    },
    [clearTimer, timerRef],
  );

  const onMove = useCallback(
    (uci: string) => {
      if (!ctxRef.current) return;
      applyPlayerMoveStep(uci);
    },
    [applyPlayerMoveStep],
  );

  const load = useCallback(async () => {
    clearTimer();
    ctxRef.current = null;
    setPuzzleData(null);
    setState(INITIAL_STATE);
    try {
      const data = await getDailyPuzzle();
      const ctx = buildContext(data);
      if (!ctx) {
        setState({ ...INITIAL_STATE, error: 'Could not load puzzle.' });
        return;
      }
      ctxRef.current = ctx;
      setPuzzleData(data);
      beginSetup(ctx);
    } catch {
      setState({ ...INITIAL_STATE, error: 'Could not load puzzle.' });
    }
  }, [beginSetup, clearTimer]);

  const onNext = useCallback(() => {
    void load();
  }, [load]);

  // Replay the same puzzle from scratch — no refetch.
  const onTryAgain = useCallback(() => {
    const ctx = ctxRef.current;
    if (ctx) beginSetup(ctx);
  }, [beginSetup]);

  // Load once on mount; clear any pending timer on unmount.
  useEffect(() => {
    void load();
    return () => clearTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, puzzleData, onMove, onReveal, onNext, onTryAgain };
}

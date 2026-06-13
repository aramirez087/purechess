'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { EndgameDrillDto, EndgameProbeDto, MoveIntent } from '@purechess/shared';
import { applyMoveToFen } from '@/lib/board/rules';
import { applyUci, solvingColorFromFen } from '@/lib/board/puzzle-utils';

/**
 * Drives an endgame drill: the user plays their side on the board and converts
 * (a 'win' drill) or holds (a 'draw' drill) against PERFECT defense.
 *
 * Defender source: after each user move we probe the resulting position via the
 * server (`probeFn` → the cached lichess tablebase). When the position is IN the
 * tablebase the defender plays the probe's `bestMove` (the toughest defence);
 * when the probe is 'unknown' (>7 men or upstream failure) we fall back to
 * Stockfish at a high movetime (`engineMoveFn`).
 *
 * Throw-the-win detection is the teaching moment. The probe's `category` is from
 * the SIDE-TO-MOVE's POV. After the user moves it is the DEFENDER to move:
 *   - win drill: defender 'loss' = the user is still winning (good). Anything
 *     else ('draw'/'win' for the defender) means the user THREW the win → fail
 *     immediately with reason 'threw-win'.
 *   - draw drill: defender 'win' = the user just LOST the draw → fail with
 *     reason 'lost-draw'. 'draw'/'loss'/'unknown' = still holding.
 *
 * Success:
 *   - win drill: the user delivers checkmate.
 *   - draw drill: a hard draw is reached (stalemate / insufficient material /
 *     threefold / 50-move) OR the user holds a non-losing position for
 *     `DRAW_HOLD_MOVES` of their own moves.
 *
 * Pure move math is reused from `puzzle-utils` (`applyUci`, `solvingColorFromFen`)
 * and `rules` (`applyMoveToFen`) — no fork. Terminal detection uses chess.js.
 */

/** How many of the user's own moves they must hold a draw before it passes. */
export const DRAW_HOLD_MOVES = 12;

export type EndgamePhase =
  | 'idle' // not started (no drill)
  | 'player' // waiting for the user's move
  | 'defending' // probing + the defender is replying
  | 'success' // objective reached
  | 'fail'; // the user threw the win / lost the draw / was mated

export type EndgameFailReason = 'threw-win' | 'lost-draw' | 'mated' | null;

export interface EndgameDrillState {
  phase: EndgamePhase;
  /** Current position FEN. */
  fen: string;
  /** The side the user plays (board orientation), from the drill's start FEN. */
  userColor: 'white' | 'black';
  /** [from, to] of the last move played, for highlighting. */
  lastMove: [string, string] | null;
  /** Count of the user's own moves played so far. */
  movesPlayed: number;
  /** Why the drill failed (null until it does). */
  failReason: EndgameFailReason;
  /** The best move (UCI) for the user to reveal on request, when known. */
  bestMove: string | null;
}

/** Terminal status of a position, derived with chess.js. Pure. */
export interface PositionStatus {
  checkmate: boolean;
  /** Any drawn termination: stalemate, insufficient material, 50-move, 3-fold. */
  draw: boolean;
  /** Whose turn it is at this FEN. */
  turn: 'w' | 'b';
}

/** Detect terminal status of a FEN (checkmate / draw / side to move). Pure. */
export function positionStatus(fen: string): PositionStatus {
  try {
    const chess = new Chess(fen);
    return {
      checkmate: chess.isCheckmate(),
      draw: chess.isStalemate() || chess.isInsufficientMaterial() || chess.isDraw(),
      turn: chess.turn(),
    };
  } catch {
    return { checkmate: false, draw: false, turn: solvingColorFromFen(fen) };
  }
}

/**
 * Whether a defender-POV probe means the user has slipped, given the objective.
 * Pure — the core throw-detection rule.
 *
 *   win  drill: defender NOT in a lost position ('loss') ⇒ the win was thrown.
 *   draw drill: defender in a winning position ('win')  ⇒ the draw was lost.
 *
 * 'unknown' is never a slip on its own (we cannot prove a flip without the
 * tablebase) — the drill keeps going and Stockfish defends.
 */
export function isSlip(
  objective: 'win' | 'draw',
  defenderCategory: EndgameProbeDto['category'],
): boolean {
  if (defenderCategory === 'unknown') return false;
  if (objective === 'win') return defenderCategory !== 'loss';
  return defenderCategory === 'win';
}

export interface UseEndgameDrillArgs {
  drill: EndgameDrillDto | null;
  /** Probe a position (server tablebase proxy). */
  probeFn: (fen: string) => Promise<EndgameProbeDto>;
  /** Stockfish fallback defender — returns the defender's UCI for a position. */
  engineMoveFn: (fen: string) => Promise<string>;
  /** Called once when the drill resolves; the caller POSTs the attempt. */
  onComplete?: (result: { succeeded: boolean; movesPlayed: number }) => void;
}

export function useEndgameDrill({
  drill,
  probeFn,
  engineMoveFn,
  onComplete,
}: UseEndgameDrillArgs) {
  const startFen = drill?.fen ?? '';
  const userColor: 'white' | 'black' = useMemo(
    () => (solvingColorFromFen(startFen) === 'b' ? 'black' : 'white'),
    [startFen],
  );

  const [state, setState] = useState<EndgameDrillState>(() => ({
    phase: drill ? 'player' : 'idle',
    fen: startFen,
    userColor,
    lastMove: null,
    movesPlayed: 0,
    failReason: null,
    bestMove: null,
  }));

  // Fires onComplete exactly once.
  const settledRef = useRef(false);
  // Latest move count (callbacks read this without re-binding).
  const movesRef = useRef(0);
  // Re-init when the drill changes.
  const drillIdRef = useRef(drill?.id ?? null);
  if (drill && drill.id !== drillIdRef.current) {
    drillIdRef.current = drill.id;
    settledRef.current = false;
    movesRef.current = 0;
    setState({
      phase: 'player',
      fen: drill.fen,
      userColor: solvingColorFromFen(drill.fen) === 'b' ? 'black' : 'white',
      lastMove: null,
      movesPlayed: 0,
      failReason: null,
      bestMove: null,
    });
  }

  const finish = useCallback(
    (succeeded: boolean) => {
      if (settledRef.current) return;
      settledRef.current = true;
      onComplete?.({ succeeded, movesPlayed: movesRef.current });
    },
    [onComplete],
  );

  /** Apply the defender's reply UCI to a FEN, defaulting through chess.js. */
  const defenderReply = useCallback(
    async (fen: string, probe: EndgameProbeDto): Promise<string | null> => {
      if (probe.category !== 'unknown' && probe.bestMove) return probe.bestMove;
      try {
        return await engineMoveFn(fen);
      } catch {
        return null;
      }
    },
    [engineMoveFn],
  );

  const onMove = useCallback(
    async (intent: MoveIntent) => {
      if (!drill) return;
      if (settledRef.current) return;

      // Read the live FEN off state via the functional updater pattern: capture
      // it synchronously first to avoid stale closures across awaits.
      let currentFen = '';
      setState((prev) => {
        currentFen = prev.fen;
        return prev;
      });
      if (!currentFen) return;

      // Only accept moves when it's the user's turn.
      if (positionStatus(currentFen).turn !== (userColor === 'white' ? 'w' : 'b')) {
        return;
      }

      const afterUser = applyMoveToFen(currentFen, intent);
      if (!afterUser) return; // illegal — ignore

      const userMoveCount = movesRef.current + 1;
      movesRef.current = userMoveCount;
      const userFromTo: [string, string] = [intent.from ?? '', intent.to ?? ''];

      // Did the user's move immediately end the game?
      const afterUserStatus = positionStatus(afterUser);
      if (afterUserStatus.checkmate) {
        // The user delivered mate.
        setState((prev) => ({
          ...prev,
          fen: afterUser,
          lastMove: userFromTo,
          movesPlayed: userMoveCount,
          phase: 'success',
          bestMove: null,
        }));
        finish(true);
        return;
      }
      if (afterUserStatus.draw) {
        // Stalemate / insufficient / 50-move / repetition after the user's move.
        const ok = drill.objective === 'draw';
        setState((prev) => ({
          ...prev,
          fen: afterUser,
          lastMove: userFromTo,
          movesPlayed: userMoveCount,
          phase: ok ? 'success' : 'fail',
          failReason: ok ? null : 'threw-win',
        }));
        finish(ok);
        return;
      }

      // Enter the defending phase while we probe + compute the reply.
      setState((prev) => ({
        ...prev,
        fen: afterUser,
        lastMove: userFromTo,
        movesPlayed: userMoveCount,
        phase: 'defending',
        bestMove: null,
      }));

      // Probe the position AFTER the user's move — it is the defender to move,
      // so the category is from the defender's POV.
      const probe = await probeFn(afterUser);
      if (settledRef.current) return;

      // Throw / slip detection: the instant teaching moment.
      if (isSlip(drill.objective, probe.category)) {
        setState((prev) => ({
          ...prev,
          phase: 'fail',
          failReason: drill.objective === 'win' ? 'threw-win' : 'lost-draw',
        }));
        finish(false);
        return;
      }

      // For a draw drill, holding long enough is a pass.
      if (drill.objective === 'draw' && userMoveCount >= DRAW_HOLD_MOVES) {
        setState((prev) => ({ ...prev, phase: 'success' }));
        finish(true);
        return;
      }

      // Defender replies (tablebase best move, or Stockfish when unknown).
      const replyUci = await defenderReply(afterUser, probe);
      if (settledRef.current) return;

      if (!replyUci) {
        // No defender move available (engine failure on an unknown position):
        // leave it as the user's turn so they can continue.
        setState((prev) => ({ ...prev, phase: 'player' }));
        return;
      }

      const applied = applyUci(afterUser, replyUci);
      const replyFen = applied?.fen ?? afterUser;
      const replyStatus = positionStatus(replyFen);

      if (replyStatus.checkmate) {
        // The defender mated the user (only possible once the user is lost).
        setState((prev) => ({
          ...prev,
          fen: replyFen,
          lastMove: applied?.lastMove ?? prev.lastMove,
          phase: 'fail',
          failReason: 'mated',
        }));
        finish(false);
        return;
      }
      if (replyStatus.draw) {
        const ok = drill.objective === 'draw';
        setState((prev) => ({
          ...prev,
          fen: replyFen,
          lastMove: applied?.lastMove ?? prev.lastMove,
          phase: ok ? 'success' : 'fail',
          failReason: ok ? null : 'threw-win',
        }));
        finish(ok);
        return;
      }

      // Back to the user.
      setState((prev) => ({
        ...prev,
        fen: replyFen,
        lastMove: applied?.lastMove ?? prev.lastMove,
        phase: 'player',
      }));
    },
    [drill, userColor, probeFn, defenderReply, finish],
  );

  /** Reveal the best move for the current position (on request). */
  const onRevealBest = useCallback(async () => {
    let fen = '';
    setState((prev) => {
      fen = prev.fen;
      return prev;
    });
    if (!fen) return;
    const probe = await probeFn(fen);
    const best = probe.category !== 'unknown' ? probe.bestMove ?? null : null;
    setState((prev) => ({ ...prev, bestMove: best }));
  }, [probeFn]);

  return { state, onMove, onRevealBest };
}

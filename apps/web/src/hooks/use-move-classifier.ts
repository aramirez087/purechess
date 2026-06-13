'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { analyze } from '@/lib/engine/stockfish-client';
import { cpToWinPercent, winLossToAccuracy } from '@/lib/board/accuracy';
import { isSacrifice } from '@/lib/board/sacrifice';
import { replayToFen } from '@/lib/replay';
import type { WireMove } from '@purechess/shared';

export type MoveClass =
  | 'brilliant'
  | 'best'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'forced';

export interface ClassifiedMove {
  /** 1-based ply. */
  ply: number;
  san: string;
  uci: string;
  /** Side that played the move — derived from the position, not ply parity. */
  color: 'w' | 'b';
  /** White-POV centipawns (normalized from mate). */
  evalBefore: number;
  /** White-POV centipawns (normalized from mate). */
  evalAfter: number;
  /** Centipawn loss (always ≥ 0, mover's POV, capped for sane ACPL). */
  cpl: number;
  /** Win-probability points lost by the move (≥ 0, mover's POV). */
  winLoss: number;
  /** 0–100 accuracy derived from `winLoss`. */
  accuracyPct: number;
  class: MoveClass;
  /** Engine's best move (UCI) in the position BEFORE this move — coach hint. */
  bestUci?: string;
}

export interface ClassificationResult {
  moves: ClassifiedMove[];
  whiteAcpl: number;
  blackAcpl: number;
  /** Mean per-move accuracy %, 0–100 (forced moves excluded, like ACPL). */
  whiteAccuracy: number;
  blackAccuracy: number;
  /** White-POV cp per ply (index 0 = start position). */
  evals: number[];
}

export interface UseMoveClassifierReturn {
  result: ClassificationResult | null;
  /** 0..1 */
  progress: number;
  running: boolean;
  run: () => void;
  reset: () => void;
}

const MATE_CP = 10000;
// Deeper than the live eval bar: classification compares two independent
// searches, so shallow noise (±40cp) masquerades as real inaccuracy. ~1.1s/move
// halves that variance — a full game still finishes under a minute.
const MOVETIME_MS = 1100;
// Centipawn cap for ACPL display: a forced mate would otherwise post a
// thousands-deep "loss" and wreck the average. Lichess caps at ±1000 too.
const CP_CAP = 1000;
// A move losing under a quarter-pawn is within search noise — never demote it
// below "good" no matter how the win% wobbled near an even eval.
const NOISE_CP = 25;

/** Clamp a centipawn eval to ±CP_CAP for the ACPL readout. */
function clampCp(cp: number): number {
  return Math.max(-CP_CAP, Math.min(CP_CAP, cp));
}

/**
 * Normalize an engine score to centipawns. Mate scores map near ±10000 so
 * CPL math works uniformly across positions with forced mates. The score
 * stays in the engine's side-to-move POV — callers sign-flip for White POV.
 */
export function normalizeEval(cp: number | undefined, mate: number | undefined): number {
  if (mate !== undefined && mate !== 0) {
    return mate > 0 ? MATE_CP - mate * 10 : -MATE_CP + mate * 10;
  }
  return cp ?? 0;
}

/**
 * Classify on win-percentage LOSS (drop in win chance, mover's POV). A negative
 * loss means the move matched or beat the engine's top line; combined with a
 * real sacrifice that's a brilliancy. Thresholds mirror chess.com's bands
 * (≈5 / 10 / 20 win% drop for inaccuracy / mistake / blunder).
 */
export function classify(winLoss: number, legalMoveCount: number, isSac = false): MoveClass {
  if (legalMoveCount === 1) return 'forced';
  if (winLoss <= 0 && isSac) return 'brilliant';
  if (winLoss < 2) return 'best';
  if (winLoss < 5) return 'good';
  if (winLoss < 10) return 'inaccuracy';
  if (winLoss < 20) return 'mistake';
  return 'blunder';
}

/**
 * White-POV eval for a terminal position, without consulting the engine
 * (Stockfish emits no score for an already-finished game): checkmate is a
 * mate-0 for the side that delivered it, every other termination is 0.
 */
function terminalEval(chess: Chess): number | null {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? -MATE_CP : MATE_CP;
  if (chess.isGameOver()) return 0;
  return null;
}

/**
 * Classifies every move of a finished game with the client-side Stockfish
 * worker (~500ms per position). Never auto-runs — `run()` is user-triggered.
 */
export function useMoveClassifier(
  moves: WireMove[],
  startFen?: string,
): UseMoveClassifierReturn {
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  // Generation counter: reset()/unmount bump it so in-flight analysis stops.
  const genRef = useRef(0);

  useEffect(() => {
    const gen = genRef;
    return () => {
      gen.current++;
    };
  }, []);

  const run = useCallback(() => {
    if (running || moves.length === 0) return;
    const gen = ++genRef.current;
    setRunning(true);
    setResult(null);
    setProgress(0);

    void (async () => {
      try {
        const fens: string[] = [];
        for (let i = 0; i <= moves.length; i++) {
          const fen = replayToFen(moves, i, startFen);
          if (!fen) return; // corrupt record — bail without a result
          fens.push(fen);
        }

        const evals: number[] = [];
        const bestMoves: (string | undefined)[] = [];
        for (let i = 0; i < fens.length; i++) {
          const fen = fens[i];
          const terminal = terminalEval(new Chess(fen));
          let whitePov: number;
          if (terminal !== null) {
            whitePov = terminal;
            bestMoves.push(undefined);
          } else {
            const line = await analyze(fen, { movetimeMs: MOVETIME_MS });
            if (genRef.current !== gen) return;
            const sign = fen.split(' ')[1] === 'b' ? -1 : 1;
            whitePov = sign * normalizeEval(line.cp, line.mate);
            bestMoves.push(line.bestmove || undefined);
          }
          evals.push(whitePov);
          setProgress((i + 1) / fens.length);
        }

        const classified: ClassifiedMove[] = [];
        let whiteSum = 0;
        let whiteCount = 0;
        let blackSum = 0;
        let blackCount = 0;
        let whiteAccSum = 0;
        let blackAccSum = 0;
        for (let ply = 1; ply <= moves.length; ply++) {
          const fenBefore = fens[ply - 1];
          const whiteMoved = fenBefore.split(' ')[1] === 'w';
          const legalMoveCount = new Chess(fenBefore).moves().length;
          // Evals are White-POV; flip to the mover's POV so "loss" is positive
          // when the move hurt the side that played it.
          const sign = whiteMoved ? 1 : -1;
          const moverBefore = sign * evals[ply - 1];
          const moverAfter = sign * evals[ply];
          // Capped centipawn loss — for the ACPL readout and the noise floor.
          const cpl = Math.max(0, clampCp(moverBefore) - clampCp(moverAfter));
          // Win-probability loss drives class + accuracy (saturates near mate).
          // Below the noise floor the move kept its eval, so we zero the loss:
          // search jitter near an even position can't fake an inaccuracy.
          const rawWinLoss =
            cpl < NOISE_CP ? 0 : cpToWinPercent(moverBefore) - cpToWinPercent(moverAfter);
          const winLoss = Math.max(0, rawWinLoss);
          // Sacrifice check only matters for the brilliant gate (win-loss ≤ 0).
          const isSac =
            rawWinLoss <= 0 && legalMoveCount > 1
              ? isSacrifice(fenBefore, moves[ply - 1].uci)
              : false;
          const cls = classify(rawWinLoss, legalMoveCount, isSac);
          const accuracyPct = winLossToAccuracy(winLoss);
          classified.push({
            ply,
            san: moves[ply - 1].san,
            uci: moves[ply - 1].uci,
            color: whiteMoved ? 'w' : 'b',
            evalBefore: evals[ply - 1],
            evalAfter: evals[ply],
            cpl,
            winLoss,
            accuracyPct,
            class: cls,
            bestUci: bestMoves[ply - 1],
          });
          if (cls !== 'forced') {
            if (whiteMoved) {
              whiteSum += cpl;
              whiteAccSum += accuracyPct;
              whiteCount++;
            } else {
              blackSum += cpl;
              blackAccSum += accuracyPct;
              blackCount++;
            }
          }
        }

        if (genRef.current !== gen) return;
        setResult({
          moves: classified,
          whiteAcpl: whiteCount > 0 ? whiteSum / whiteCount : 0,
          blackAcpl: blackCount > 0 ? blackSum / blackCount : 0,
          whiteAccuracy: whiteCount > 0 ? whiteAccSum / whiteCount : 0,
          blackAccuracy: blackCount > 0 ? blackAccSum / blackCount : 0,
          evals,
        });
      } catch {
        // Engine failure (worker died, cancelled job) — leave result null.
      } finally {
        if (genRef.current === gen) setRunning(false);
      }
    })();
  }, [moves, startFen, running]);

  const reset = useCallback(() => {
    genRef.current++;
    setResult(null);
    setProgress(0);
    setRunning(false);
  }, []);

  return { result, progress, running, run, reset };
}

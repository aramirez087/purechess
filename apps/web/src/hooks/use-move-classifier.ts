'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { analyze } from '@/lib/engine/stockfish-client';
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
  /** White-POV centipawns (normalized from mate). */
  evalBefore: number;
  /** White-POV centipawns (normalized from mate). */
  evalAfter: number;
  /** Centipawn loss (always ≥ 0, from the mover's perspective). */
  cpl: number;
  class: MoveClass;
}

export interface ClassificationResult {
  moves: ClassifiedMove[];
  whiteAcpl: number;
  blackAcpl: number;
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
const MOVETIME_MS = 500;

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
 * Classify on the RAW (unclamped) CPL: a negative loss means the move beat
 * the engine's top line — that's what makes 'brilliant' rare. The stored
 * `cpl` is clamped at 0 (engine fluctuates ±2cp at equal depth).
 */
export function classify(cpl: number, legalMoveCount: number): MoveClass {
  if (legalMoveCount === 1) return 'forced';
  if (cpl <= 0) return 'brilliant';
  if (cpl <= 5) return 'best';
  if (cpl <= 20) return 'good';
  if (cpl <= 50) return 'inaccuracy';
  if (cpl <= 100) return 'mistake';
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
        for (let i = 0; i < fens.length; i++) {
          const fen = fens[i];
          const terminal = terminalEval(new Chess(fen));
          let whitePov: number;
          if (terminal !== null) {
            whitePov = terminal;
          } else {
            const line = await analyze(fen, { movetimeMs: MOVETIME_MS });
            if (genRef.current !== gen) return;
            const sign = fen.split(' ')[1] === 'b' ? -1 : 1;
            whitePov = sign * normalizeEval(line.cp, line.mate);
          }
          evals.push(whitePov);
          setProgress((i + 1) / fens.length);
        }

        const classified: ClassifiedMove[] = [];
        let whiteSum = 0;
        let whiteCount = 0;
        let blackSum = 0;
        let blackCount = 0;
        for (let ply = 1; ply <= moves.length; ply++) {
          const fenBefore = fens[ply - 1];
          const whiteMoved = fenBefore.split(' ')[1] === 'w';
          const legalMoveCount = new Chess(fenBefore).moves().length;
          const rawCpl = whiteMoved
            ? evals[ply - 1] - evals[ply]
            : evals[ply] - evals[ply - 1];
          const cls = classify(rawCpl, legalMoveCount);
          const cpl = Math.max(0, rawCpl);
          classified.push({
            ply,
            san: moves[ply - 1].san,
            uci: moves[ply - 1].uci,
            evalBefore: evals[ply - 1],
            evalAfter: evals[ply],
            cpl,
            class: cls,
          });
          if (cls !== 'forced') {
            if (whiteMoved) {
              whiteSum += cpl;
              whiteCount++;
            } else {
              blackSum += cpl;
              blackCount++;
            }
          }
        }

        if (genRef.current !== gen) return;
        setResult({
          moves: classified,
          whiteAcpl: whiteCount > 0 ? whiteSum / whiteCount : 0,
          blackAcpl: blackCount > 0 ? blackSum / blackCount : 0,
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

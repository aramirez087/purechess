'use client';

import { useEffect, useRef, useState } from 'react';
import { analyze, analyzeLines } from '@/lib/engine/stockfish-client';
import type { EngineEval } from '@purechess/shared';

/** One multipv engine line, scores normalized to White's POV. */
export interface EngineLine {
  /** Centipawns from White's POV; absent when the line ends in mate. */
  cp?: number;
  /** Signed moves-to-mate from White's POV (+ = White mates). */
  mate?: number;
  depth: number;
  /** Principal variation, UCI. */
  pv: string[];
}

export interface PositionEval {
  /** Centipawns from White's POV; absent when a mate is found. */
  cp?: number;
  /** Signed moves-to-mate from White's POV (+ = White mates). */
  mate?: number;
  depth: number;
  /** Best move, UCI. */
  bestmove: string;
  /** Full principal variation from the engine, UCI. */
  pv: string[];
}

export interface PositionEvalOptions {
  /** Engine lines to request (1-3, default 1). Lines beyond the first land in `lines`. */
  multiPv?: number;
}

function normalizeLine(line: EngineEval, sign: 1 | -1): EngineLine {
  return {
    depth: line.depth,
    pv: line.pv,
    ...(line.cp !== undefined ? { cp: line.cp * sign } : {}),
    ...(line.mate !== undefined ? { mate: line.mate * sign } : {}),
  };
}

/**
 * Evaluates `fen` with the local Stockfish worker (full strength, short
 * movetime), debounced for seek-scrubbing. Scores are normalized to White's
 * POV. Returns the last completed evaluation plus a `thinking` flag, so the
 * bar holds its position instead of flickering while a new search runs.
 *
 * With `multiPv > 1` the full multipv array is exposed as `lines` (index 0 =
 * best, same line as `evaluation`); with the default single line, `lines`
 * stays undefined.
 */
export function usePositionEval(
  fen: string | null,
  enabled: boolean,
  options?: PositionEvalOptions,
): { evaluation: PositionEval | null; thinking: boolean; lines?: EngineLine[] } {
  const multiPv = Math.max(1, Math.min(3, options?.multiPv ?? 1));
  const [evaluation, setEvaluation] = useState<PositionEval | null>(null);
  const [lines, setLines] = useState<EngineLine[] | undefined>(undefined);
  const [thinking, setThinking] = useState(false);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!fen || !enabled) {
      setEvaluation(null);
      setLines(undefined);
      setThinking(false);
      return;
    }

    const seq = ++seqRef.current;
    setThinking(true);

    const timer = setTimeout(() => {
      const search =
        multiPv > 1
          ? analyzeLines(fen, { movetimeMs: 700, multiPv })
          : analyze(fen, { movetimeMs: 700 }).then((line) => [line]);
      search
        .then((engineLines) => {
          if (seqRef.current !== seq) return;
          const sign = fen.split(' ')[1] === 'b' ? -1 : 1;
          const normalized = engineLines.map((line) => normalizeLine(line, sign));
          setEvaluation({
            ...normalized[0],
            bestmove: engineLines[0].bestmove,
          });
          setLines(multiPv > 1 ? normalized : undefined);
          setThinking(false);
        })
        .catch(() => {
          if (seqRef.current === seq) setThinking(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [fen, enabled, multiPv]);

  return { evaluation, thinking, lines };
}

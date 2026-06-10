'use client';

import { useEffect, useRef, useState } from 'react';
import { analyze } from '@/lib/engine/stockfish-client';

export interface PositionEval {
  /** Centipawns from White's POV; absent when a mate is found. */
  cp?: number;
  /** Signed moves-to-mate from White's POV (+ = White mates). */
  mate?: number;
  depth: number;
  /** Best move, UCI. */
  bestmove: string;
}

/**
 * Evaluates `fen` with the local Stockfish worker (full strength, short
 * movetime), debounced for seek-scrubbing. Scores are normalized to White's
 * POV. Returns the last completed evaluation plus a `thinking` flag, so the
 * bar holds its position instead of flickering while a new search runs.
 */
export function usePositionEval(
  fen: string | null,
  enabled: boolean,
): { evaluation: PositionEval | null; thinking: boolean } {
  const [evaluation, setEvaluation] = useState<PositionEval | null>(null);
  const [thinking, setThinking] = useState(false);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!fen || !enabled) {
      setEvaluation(null);
      setThinking(false);
      return;
    }

    const seq = ++seqRef.current;
    setThinking(true);

    const timer = setTimeout(() => {
      analyze(fen, { movetimeMs: 700 })
        .then((line) => {
          if (seqRef.current !== seq) return;
          const blackToMove = fen.split(' ')[1] === 'b';
          const sign = blackToMove ? -1 : 1;
          setEvaluation({
            cp: line.cp !== undefined ? line.cp * sign : undefined,
            mate: line.mate !== undefined ? line.mate * sign : undefined,
            depth: line.depth,
            bestmove: line.bestmove,
          });
          setThinking(false);
        })
        .catch(() => {
          if (seqRef.current === seq) setThinking(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [fen, enabled]);

  return { evaluation, thinking };
}

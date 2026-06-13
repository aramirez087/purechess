'use client';

import { useEffect, useState } from 'react';
import type { Square } from '@purechess/shared';
import { loadRules, peekRules } from '@/lib/board/rules-lazy';

export interface ReplayLine {
  /** FEN after each ply; `fens[0]` is the start, `fens[k]` follows ply k. */
  fens: string[];
  /** Squares of the move that produced each FEN; `lastMoves[0]` is null. */
  lastMoves: Array<{ from: Square; to: Square } | null>;
}

/**
 * Lazily replays a live game's SAN move list into per-ply FENs so the board can
 * render historical positions while a player browses back (e.g. while waiting
 * for the opponent). chess.js is lazy — the eager board chunk omits it — so
 * until it warms this returns null and the caller shows the live position.
 * Recomputes whenever the move list changes (a new move was played).
 */
export function useReplaySan(sanMoves: string[]): ReplayLine | null {
  const key = sanMoves.join(' ');
  const [line, setLine] = useState<ReplayLine | null>(() => {
    const rules = peekRules();
    return rules ? rules.replaySanLine(sanMoves) : null;
  });

  useEffect(() => {
    let cancelled = false;
    void loadRules().then((rules) => {
      if (!cancelled) setLine(rules.replaySanLine(sanMoves));
    });
    return () => {
      cancelled = true;
    };
    // sanMoves is keyed by its joined string; identity churn is irrelevant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return line;
}

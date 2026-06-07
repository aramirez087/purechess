'use client';

import { useState, useMemo } from 'react';
import { replayToFen, validateReplay } from '@/lib/replay';
import type { GameReview } from '@/types/game-review';
import type { Square } from '@purchess/shared';

export interface GameReviewState {
  ply: number;
  fen: string | null;
  lastMove: { from: Square; to: Square } | null;
  isCorrupt: boolean;
  goTo: (n: number) => void;
  goNext: () => void;
  goPrev: () => void;
  goStart: () => void;
  goEnd: () => void;
}

export function useGameReview(game: GameReview): GameReviewState {
  const isCorrupt = useMemo(() => !validateReplay(game.moves, game.finalFen), [game]);
  const [ply, setPly] = useState(0);

  const fen = useMemo(() => replayToFen(game.moves, ply), [game.moves, ply]);

  const lastMove = useMemo((): { from: Square; to: Square } | null => {
    if (ply === 0) return null;
    const m = game.moves[ply - 1];
    return { from: m.uci.slice(0, 2) as Square, to: m.uci.slice(2, 4) as Square };
  }, [game.moves, ply]);

  const goTo = (n: number) => setPly(Math.max(0, Math.min(n, game.moves.length)));
  const goNext = () => setPly(p => Math.min(p + 1, game.moves.length));
  const goPrev = () => setPly(p => Math.max(p - 1, 0));
  const goStart = () => setPly(0);
  const goEnd = () => setPly(game.moves.length);

  return { ply, fen, lastMove, isCorrupt, goTo, goNext, goPrev, goStart, goEnd };
}

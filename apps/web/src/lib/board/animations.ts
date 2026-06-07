import { Chess } from 'chess.js';
import type { Square } from '@purechess/shared';

export const MOVE_DURATION_MS = 200;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface AnimationSquares {
  from: Square;
  to: Square;
  capturedAt?: Square;
  rookFrom?: Square;
  rookTo?: Square;
}

export function getAnimationSquares(
  prevFen: string,
  nextFen: string,
): AnimationSquares | null {
  try {
    const prev = new Chess(prevFen);
    const moves = prev.moves({ verbose: true });

    for (const move of moves) {
      const test = new Chess(prevFen);
      const result = test.move({ from: move.from, to: move.to, promotion: move.promotion });
      if (!result) continue;

      if (test.fen().split(' ').slice(0, 4).join(' ') === nextFen.split(' ').slice(0, 4).join(' ')) {
        const anim: AnimationSquares = {
          from: move.from as Square,
          to: move.to as Square,
        };

        if (move.captured) {
          if (move.flags.includes('e')) {
            const epFile = move.to[0];
            const epRank = move.color === 'w' ? String(Number(move.to[1]) - 1) : String(Number(move.to[1]) + 1);
            anim.capturedAt = (epFile + epRank) as Square;
          } else {
            anim.capturedAt = move.to as Square;
          }
        }

        if (move.flags.includes('k')) {
          anim.rookFrom = (move.color === 'w' ? 'h1' : 'h8') as Square;
          anim.rookTo = (move.color === 'w' ? 'f1' : 'f8') as Square;
        } else if (move.flags.includes('q')) {
          anim.rookFrom = (move.color === 'w' ? 'a1' : 'a8') as Square;
          anim.rookTo = (move.color === 'w' ? 'd1' : 'd8') as Square;
        }

        return anim;
      }
    }
    return null;
  } catch {
    return null;
  }
}

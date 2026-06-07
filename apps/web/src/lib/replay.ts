import { Chess } from 'chess.js';
import type { WireMove } from '@purchess/shared';

export function replayToFen(moves: WireMove[], ply: number): string | null {
  if (ply < 0 || ply > moves.length) return null;
  const chess = new Chess();
  for (let i = 0; i < ply; i++) {
    const m = moves[i];
    const from = m.uci.slice(0, 2) as Parameters<typeof chess.move>[0] extends string ? never : never;
    const to = m.uci.slice(2, 4);
    const promotion = m.uci.length === 5 ? m.uci[4] : undefined;
    try {
      chess.move({ from: m.uci.slice(0, 2), to, promotion } as Parameters<typeof chess.move>[0]);
    } catch {
      return null;
    }
  }
  return chess.fen();
}

export function validateReplay(moves: WireMove[], finalFen: string): boolean {
  const replayed = replayToFen(moves, moves.length);
  if (!replayed) return false;
  return normalizeFen(replayed) === normalizeFen(finalFen);
}

function normalizeFen(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

import { Chess } from 'chess.js';
import type { Square, PieceType } from '@purchess/shared';

export interface Premove {
  from: Square;
  to: Square;
  promotion?: PieceType;
}

export function isPremoveLegal(fen: string, premove: Premove): boolean {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    return moves.some(
      (m) =>
        m.from === premove.from &&
        m.to === premove.to &&
        (!premove.promotion || m.promotion === premove.promotion),
    );
  } catch {
    return false;
  }
}

export function validatePremove(fen: string, premove: Premove): Premove | null {
  if (isPremoveLegal(fen, premove)) return premove;
  return null;
}

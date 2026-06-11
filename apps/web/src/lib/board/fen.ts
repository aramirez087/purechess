import type { Square, PieceType, Color, Piece } from '@purechess/shared';

/**
 * Pure FEN parsing — zero dependencies, safe to ship in the eager board
 * chunk. Anything that needs actual chess RULES (legality, check detection,
 * move application) lives in `rules.ts` behind the lazy `rules-lazy.ts`
 * loader so chess.js stays out of the route-critical bundle.
 */

const PIECE_CHARS = new Set(['p', 'n', 'b', 'r', 'q', 'k']);

/**
 * Expands the FEN placement field into a square→piece map.
 * Returns null for anything that is not 8 ranks of exactly 8 cells.
 */
export function parseFenBoard(fen: string): Map<Square, Piece> | null {
  const placement = fen.trim().split(/\s+/)[0];
  if (!placement) return null;
  const ranks = placement.split('/');
  if (ranks.length !== 8) return null;

  const board = new Map<Square, Piece>();
  for (let r = 0; r < 8; r++) {
    const rankStr = ranks[r]!;
    const rankNo = 8 - r;
    let file = 0;
    for (const ch of rankStr) {
      if (ch >= '1' && ch <= '8') {
        file += Number(ch);
        continue;
      }
      const lower = ch.toLowerCase();
      if (!PIECE_CHARS.has(lower) || file > 7) return null;
      const square = `${String.fromCharCode(97 + file)}${rankNo}` as Square;
      board.set(square, {
        type: lower as PieceType,
        color: ch === lower ? 'b' : 'w',
      });
      file++;
    }
    if (file !== 8) return null;
  }
  return board;
}

export function getPieceAt(fen: string, square: Square): Piece | null {
  return parseFenBoard(fen)?.get(square) ?? null;
}

export function fenToColorToMove(fen: string): Color {
  return fen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w';
}

/** True when the move is a pawn reaching its promotion rank. */
export function isPromotion(from: Square, to: Square, fen: string): boolean {
  const piece = getPieceAt(fen, from);
  if (!piece || piece.type !== 'p') return false;
  const toRank = to[1];
  return (piece.color === 'w' && toRank === '8') || (piece.color === 'b' && toRank === '1');
}

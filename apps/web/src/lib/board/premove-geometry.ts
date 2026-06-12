import type { Piece, Square } from '@purechess/shared';
import { fenToColorToMove, parseFenBoard } from './fen';

function toSquare(file: number, rank: number): Square {
  return `${String.fromCharCode(97 + file)}${rank + 1}` as Square;
}

function canReach(piece: Piece, file: number, rank: number, f: number, r: number): boolean {
  const df = f - file;
  const dr = r - rank;
  const adf = Math.abs(df);
  const adr = Math.abs(dr);
  switch (piece.type) {
    case 'p': {
      const dir = piece.color === 'w' ? 1 : -1;
      const startRank = piece.color === 'w' ? 1 : 6;
      // Forward push or diagonal capture, plus the double push from the start
      // rank — occupancy is irrelevant, the board may change before it fires.
      if (dr === dir && adf <= 1) return true;
      return df === 0 && dr === 2 * dir && rank === startRank;
    }
    case 'n':
      return (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
    case 'b':
      return adf === adr;
    case 'r':
      return df === 0 || dr === 0;
    case 'q':
      return adf === adr || df === 0 || dr === 0;
    case 'k':
      return Math.max(adf, adr) === 1;
  }
}

function canCastleTo(
  piece: Piece,
  board: Map<Square, Piece>,
  file: number,
  rank: number,
  f: number,
  r: number,
): boolean {
  if (piece.type !== 'k' || file !== 4) return false;
  const homeRank = piece.color === 'w' ? 0 : 7;
  if (rank !== homeRank || r !== homeRank) return false;
  const rookSquare = f === 6 ? toSquare(7, homeRank) : f === 2 ? toSquare(0, homeRank) : null;
  if (!rookSquare) return false;
  const rook = board.get(rookSquare);
  return rook?.type === 'r' && rook.color === piece.color;
}

/**
 * Geometric premove destinations (chessground-style): every square the piece
 * at `square` could reach by its movement pattern, ignoring blockers along
 * the path and check — the position will change before the premove fires, so
 * only geometry is knowable now. Friendly-occupied destinations are excluded.
 * Castling premoves (e1→g1/c1, e8→g8/c8) require the matching rook to still
 * sit on its home square.
 *
 * Pure coordinate math, no chess.js. Returns [] when the square is empty or
 * it IS the piece owner's turn (a premove queues for the side not to move) —
 * which also yields [] for every opponent piece. chess.js `validatePremove`
 * still gates the queued move for real legality when the turn arrives.
 */
export function getPremoveDestinations(fen: string, square: Square): Square[] {
  const board = parseFenBoard(fen);
  if (!board) return [];
  const piece = board.get(square);
  if (!piece) return [];
  if (fenToColorToMove(fen) === piece.color) return [];

  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  const dests: Square[] = [];

  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      if (f === file && r === rank) continue;
      const dest = toSquare(f, r);
      const occupant = board.get(dest);
      if (occupant && occupant.color === piece.color) continue;
      if (canReach(piece, file, rank, f, r) || canCastleTo(piece, board, file, rank, f, r)) {
        dests.push(dest);
      }
    }
  }
  return dests;
}

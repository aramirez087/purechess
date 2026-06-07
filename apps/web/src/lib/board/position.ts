import { Chess } from 'chess.js';
import type { Square, PieceType, Color, Piece } from '@purchess/shared';

export function getLegalMovesForSquare(fen: string, square: Square): Square[] {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ square, verbose: true });
    return moves.map((m) => m.to as Square);
  } catch {
    return [];
  }
}

export function getLegalCapturesForSquare(fen: string, square: Square): Square[] {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ square, verbose: true });
    return moves.filter((m) => m.captured !== undefined).map((m) => m.to as Square);
  } catch {
    return [];
  }
}

export function isKingInCheck(fen: string): boolean {
  try {
    const chess = new Chess(fen);
    return chess.inCheck();
  } catch {
    return false;
  }
}

export function getCheckSquare(fen: string): Square | undefined {
  try {
    const chess = new Chess(fen);
    if (!chess.inCheck()) return undefined;
    const turn = chess.turn();
    const board = chess.board();
    for (const row of board) {
      for (const sq of row) {
        if (sq && sq.type === 'k' && sq.color === turn) {
          return sq.square as Square;
        }
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function getPieceAt(fen: string, square: Square): Piece | null {
  try {
    const chess = new Chess(fen);
    const piece = chess.get(square);
    if (!piece) return null;
    return { type: piece.type as PieceType, color: piece.color as Color };
  } catch {
    return null;
  }
}

export function fenToColorToMove(fen: string): Color {
  try {
    const chess = new Chess(fen);
    return chess.turn() as Color;
  } catch {
    return 'w';
  }
}

export function isPromotion(from: Square, to: Square, fen: string): boolean {
  try {
    const chess = new Chess(fen);
    const piece = chess.get(from);
    if (!piece || piece.type !== 'p') return false;
    const toRank = to[1];
    if (piece.color === 'w' && toRank === '8') return true;
    if (piece.color === 'b' && toRank === '1') return true;
    return false;
  } catch {
    return false;
  }
}

export function getAllLegalMoves(fen: string): Array<{ from: Square; to: Square }> {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    return moves.map((m) => ({ from: m.from as Square, to: m.to as Square }));
  } catch {
    return [];
  }
}

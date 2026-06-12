import type { Piece, Square } from '@purechess/shared';
import type { AnimationSquares } from './animations';
import { parseFenBoard } from './fen';

interface PlacedPiece {
  piece: Piece;
  at: Square;
}

interface PieceMove {
  piece: Piece;
  from: Square;
  to: Square;
}

function fileOf(sq: Square): number {
  return sq.charCodeAt(0) - 97;
}

function rankOf(sq: Square): number {
  return sq.charCodeAt(1) - 49;
}

function manhattan(a: Square, b: Square): number {
  return Math.abs(fileOf(a) - fileOf(b)) + Math.abs(rankOf(a) - rankOf(b));
}

function samePiece(a: Piece, b: Piece): boolean {
  return a.type === b.type && a.color === b.color;
}

/**
 * Pure-FEN move plan for the animation layer: diffs the piece placement of
 * two consecutive positions and reconstructs which piece slid where, with no
 * chess.js dependency — so the very first move animates even before the lazy
 * rules chunk resolves.
 *
 * Each appeared piece is matched to the closest vacated square holding the
 * same color+type (Manhattan distance, chessground-style); a promotion
 * matches the closest same-color pawn instead. A lone unmatched vacated
 * square of the opposing color is the capture victim (covers en passant,
 * where the victim is not on the destination square). Returns null when the
 * diff doesn't read as a single move (multi-ply jumps, pieces materializing)
 * — the same no-animation fallback the rules-based diff had.
 */
export function diffPositions(prevFen: string, nextFen: string): AnimationSquares | null {
  const prev = parseFenBoard(prevFen);
  const next = parseFenBoard(nextFen);
  if (!prev || !next) return null;

  const appeared: PlacedPiece[] = [];
  const unmatched: PlacedPiece[] = [];

  for (const [sq, piece] of next) {
    const before = prev.get(sq);
    if (!before || !samePiece(before, piece)) appeared.push({ piece, at: sq });
  }
  for (const [sq, piece] of prev) {
    const after = next.get(sq);
    if (!after || !samePiece(after, piece)) unmatched.push({ piece, at: sq });
  }

  const moves: PieceMove[] = [];
  for (const { piece, at } of appeared) {
    let candidates = unmatched.filter((d) => samePiece(d.piece, piece));
    const promotionRank = piece.color === 'w' ? 7 : 0;
    if (candidates.length === 0 && piece.type !== 'p' && rankOf(at) === promotionRank) {
      candidates = unmatched.filter((d) => d.piece.color === piece.color && d.piece.type === 'p');
    }
    if (candidates.length === 0) return null;
    let best = candidates[0]!;
    for (const c of candidates) {
      if (manhattan(c.at, at) < manhattan(best.at, at)) best = c;
    }
    unmatched.splice(unmatched.indexOf(best), 1);
    moves.push({ piece: best.piece, from: best.at, to: at });
  }

  if (moves.length === 1) {
    const move = moves[0]!;
    if (unmatched.length > 1) return null;
    let capturedAt: Square | undefined;
    if (unmatched.length === 1) {
      const victim = unmatched[0]!;
      if (victim.piece.color === move.piece.color) return null;
      capturedAt = victim.at;
    }
    return { from: move.from, to: move.to, capturedAt };
  }

  if (moves.length === 2 && unmatched.length === 0) {
    const king = moves.find(
      (m) => m.piece.type === 'k' && Math.abs(fileOf(m.to) - fileOf(m.from)) >= 2,
    );
    const rook = moves.find((m) => m.piece.type === 'r');
    if (
      king &&
      rook &&
      rook.piece.color === king.piece.color &&
      rankOf(rook.from) === rankOf(king.from) &&
      rankOf(rook.to) === rankOf(king.to)
    ) {
      return { from: king.from, to: king.to, rookFrom: rook.from, rookTo: rook.to };
    }
  }

  return null;
}

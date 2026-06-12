import { Chess } from 'chess.js';
import type { Square, MoveIntent } from '@purechess/shared';
import type { Premove, SoundType } from './types';
import type { AnimationSquares } from './animations';

/**
 * Everything that needs actual chess rules — and therefore chess.js (~18 kB
 * gz). This module must NEVER be statically imported from the eager board
 * chunk (chessboard, board hooks, game clients): go through `rules-lazy.ts`
 * instead. Pure FEN parsing lives in `fen.ts`.
 */

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

export function getAllLegalMoves(fen: string): Array<{ from: Square; to: Square }> {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    return moves.map((m) => ({ from: m.from as Square, to: m.to as Square }));
  } catch {
    return [];
  }
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

/**
 * Applies a move to a FEN and returns the resulting FEN, or null when the
 * move is illegal or the FEN unparseable. Used for optimistic rendering —
 * the server stays the judge.
 */
export function applyMoveToFen(fen: string, intent: MoveIntent): string | null {
  if (!intent.from || !intent.to) return null;
  try {
    const chess = new Chess(fen);
    const m = chess.move({ from: intent.from, to: intent.to, promotion: intent.promotion });
    return m ? chess.fen() : null;
  } catch {
    return null;
  }
}

/**
 * Applies a move and returns everything the analysis tree needs (SAN, UCI,
 * resulting FEN), or null when illegal/unparseable.
 */
export function makeMove(
  fen: string,
  intent: MoveIntent,
): { san: string; uci: string; fenAfter: string } | null {
  if (!intent.from || !intent.to) return null;
  try {
    const chess = new Chess(fen);
    const m = chess.move({ from: intent.from, to: intent.to, promotion: intent.promotion });
    if (!m) return null;
    return { san: m.san, uci: m.from + m.to + (m.promotion ?? ''), fenAfter: chess.fen() };
  } catch {
    return null;
  }
}

/** First legal move as UCI — used to claim a flag fall with any legal move. */
export function firstLegalUci(fen: string): string | null {
  try {
    const m = new Chess(fen).moves({ verbose: true })[0];
    return m ? m.from + m.to + (m.promotion ?? '') : null;
  } catch {
    return null;
  }
}

/**
 * Sound for a confirmed position change, by what happened:
 * mate > check > capture > move. Null when the diff is not a single move.
 */
export function classifyMoveSound(prevFen: string, nextFen: string): SoundType | null {
  const squares = getAnimationSquares(prevFen, nextFen);
  if (!squares) return null;
  try {
    const next = new Chess(nextFen);
    if (next.isCheckmate()) return 'mate';
    if (next.inCheck()) return 'check';
  } catch {
    // unparseable FEN — fall through to the generic sound
  }
  return squares.capturedAt ? 'capture' : 'move';
}

export function getAnimationSquares(prevFen: string, nextFen: string): AnimationSquares | null {
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
            const epRank =
              move.color === 'w' ? String(Number(move.to[1]) - 1) : String(Number(move.to[1]) + 1);
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

const PIECE_NAMES: Record<string, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

const PROMO_NAMES: Record<string, string> = {
  q: 'Queen',
  r: 'Rook',
  b: 'Bishop',
  n: 'Knight',
};

/**
 * Derives a human-readable SR announcement from consecutive FENs.
 * Returns null when the position is unchanged or the diff is ambiguous.
 *
 * Examples:
 *   "Knight to f3"
 *   "Bishop takes c5, check"
 *   "Queen takes f7, checkmate"
 *   "Castles kingside"
 *   "Pawn to e8, promoting to Queen"
 */
export function buildMoveAnnouncement(prevFen: string, nextFen: string): string | null {
  if (prevFen === nextFen) return null;
  try {
    const chess = new Chess(prevFen);
    const moves = chess.moves({ verbose: true });
    const nextPrefix = nextFen.split(' ').slice(0, 4).join(' ');

    for (const move of moves) {
      const test = new Chess(prevFen);
      const result = test.move({ from: move.from, to: move.to, promotion: move.promotion });
      if (!result) continue;
      if (test.fen().split(' ').slice(0, 4).join(' ') !== nextPrefix) continue;

      if (move.flags.includes('k')) return 'Castles kingside';
      if (move.flags.includes('q')) return 'Castles queenside';

      const pieceName = PIECE_NAMES[move.piece] ?? 'Piece';
      const verb = move.captured ? 'takes' : 'to';
      let text = `${pieceName} ${verb} ${move.to}`;

      if (move.promotion) {
        text += `, promoting to ${PROMO_NAMES[move.promotion] ?? move.promotion}`;
      }

      if (test.isCheckmate()) {
        text += ', checkmate';
      } else if (test.isStalemate()) {
        text += '. Stalemate, draw';
      } else if (test.isInsufficientMaterial()) {
        text += '. Draw by insufficient material';
      } else if (test.inCheck()) {
        text += ', check';
      }

      return text;
    }
    return null;
  } catch {
    return null;
  }
}

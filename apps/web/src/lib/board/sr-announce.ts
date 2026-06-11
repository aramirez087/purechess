import { Chess } from 'chess.js';

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

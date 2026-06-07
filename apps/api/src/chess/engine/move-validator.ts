import { Chess } from 'chess.js';
import { MoveIntent, Square } from '@purechess/shared';

export type MoveValidationResult =
  | { ok: true; newChess: Chess; san: string; uci: string }
  | { ok: false; reason: string };

function parseUci(uci: string): { from: string; to: string; promotion?: string } | null {
  if (uci.length < 4 || uci.length > 5) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? uci[4] : undefined,
  };
}

export function validateMove(chess: Chess, intent: MoveIntent): MoveValidationResult {
  let from: string;
  let to: string;
  let promotion: string | undefined;

  if (intent.uci) {
    const parsed = parseUci(intent.uci);
    if (!parsed) {
      return { ok: false, reason: 'Invalid UCI format' };
    }
    from = parsed.from;
    to = parsed.to;
    promotion = parsed.promotion;
  } else if (intent.from && intent.to) {
    from = intent.from;
    to = intent.to;
    promotion = intent.promotion;
  } else {
    return { ok: false, reason: 'Move intent must specify uci or from/to' };
  }

  const piece = chess.get(from as Square);
  if (piece?.type === 'p') {
    const toRank = to[1];
    const isPromoting =
      (piece.color === 'w' && toRank === '8') || (piece.color === 'b' && toRank === '1');
    if (isPromoting && !promotion) {
      return { ok: false, reason: 'Promotion piece required for pawn reaching last rank' };
    }
  }

  const cloned = new Chess(chess.fen());
  try {
    const move = cloned.move({ from, to, promotion });
    const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
    return { ok: true, newChess: cloned, san: move.san, uci };
  } catch {
    return { ok: false, reason: 'Illegal move' };
  }
}

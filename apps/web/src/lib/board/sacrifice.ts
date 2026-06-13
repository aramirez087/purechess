/**
 * Sacrifice detection for the "brilliant" classification. Pure (chess.js only).
 *
 * At shallow search depth the engine's eval wobbles a few centipawns, so "the
 * move matched or beat the top line" (cpl ≤ 0) fires on ordinary moves and
 * cheapens a !! badge. A real brilliancy gives up material that stays sound —
 * so we gate `brilliant` on a genuine material sacrifice, judged by a static
 * exchange evaluation on the move's destination square.
 */

import { Chess } from 'chess.js';
import type { PieceSymbol } from 'chess.js';

const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 100,
  n: 300,
  b: 300,
  r: 500,
  q: 900,
  k: 20000,
};

/**
 * Static exchange value (centipawns) the side-to-move can win by capturing on
 * `to`, assuming both sides always recapture with their least-valuable piece
 * and either side may stop when ahead. Recursive, bounded by the attacker count.
 */
function seeGain(chess: Chess, to: string): number {
  const captures = chess
    .moves({ verbose: true })
    .filter((m) => m.to === to && m.captured);
  if (captures.length === 0) return 0;
  captures.sort((a, b) => PIECE_VALUE[a.piece] - PIECE_VALUE[b.piece]);
  const move = captures[0];
  const captured = PIECE_VALUE[move.captured as PieceSymbol];
  chess.move(move);
  // Standing pat: never make a capture sequence that loses material.
  const value = Math.max(0, captured - seeGain(chess, to));
  chess.undo();
  return value;
}

/**
 * True when `uci` (from `fenBefore`) concedes ~a minor piece or more through
 * the exchange series on its destination square — captured material minus what
 * the opponent wins back. Returns false for illegal moves and clean trades.
 */
export function isSacrifice(fenBefore: string, uci: string): boolean {
  const chess = new Chess(fenBefore);
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  let played;
  try {
    played = chess.move({ from, to, promotion });
  } catch {
    return false;
  }
  if (!played) return false;
  const won = played.captured ? PIECE_VALUE[played.captured as PieceSymbol] : 0;
  // chess now has the opponent to move — what they net by grabbing on `to`.
  const opponentWinsBack = seeGain(chess, to);
  return won - opponentWinsBack <= -200;
}

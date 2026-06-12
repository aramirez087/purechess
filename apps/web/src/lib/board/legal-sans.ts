import { Chess } from 'chess.js';
import type { Square } from '@purechess/shared';

/**
 * Legal-move enumeration + query matching for the text move input overlay.
 * Statically imports chess.js, so (like rules.ts) this module must NEVER be
 * statically imported from the eager board path — use-move-input loads it
 * via dynamic import.
 */

export interface MoveMatch {
  san: string;
  /** e.g. "g1f3", "e7e8q" */
  uci: string;
  from: Square;
  to: Square;
  promotion?: string;
}

/** All legal moves in the position, for the overlay's autocomplete. */
export function legalSans(fen: string): MoveMatch[] {
  try {
    const chess = new Chess(fen);
    return chess.moves({ verbose: true }).map((m) => ({
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ''),
      from: m.from as Square,
      to: m.to as Square,
      promotion: m.promotion,
    }));
  } catch {
    return [];
  }
}

/** Check/mate suffixes don't have to be typed: "nf3" matches "Nf3+". */
function cleanSan(san: string): string {
  return san.replace(/[+#]/g, '').toLowerCase();
}

/**
 * Matches by SAN prefix or UCI prefix (case-insensitive), sorted by SAN.
 * Empty query returns every move.
 */
export function filterMoves(moves: MoveMatch[], query: string): MoveMatch[] {
  const q = query.trim().toLowerCase();
  const out = q
    ? moves.filter((m) => cleanSan(m.san).startsWith(q) || m.uci.startsWith(q))
    : [...moves];
  return out.sort((a, b) => a.san.localeCompare(b.san));
}

/**
 * A match the overlay may submit without Enter: the query spells the whole
 * move — a full SAN (check suffix optional) or a 4+ char UCI. 2-char
 * partials like "e2" never auto-confirm.
 */
export function isFullMatch(match: MoveMatch, query: string): boolean {
  const q = query.trim().toLowerCase();
  return cleanSan(match.san) === q || (q.length >= 4 && match.uci.startsWith(q));
}

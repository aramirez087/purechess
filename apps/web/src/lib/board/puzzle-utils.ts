import { Chess } from 'chess.js';

/**
 * Pure helpers for the daily-puzzle flow: replaying the puzzle game's PGN to
 * the starting position and comparing the solver's UCI moves against the
 * Lichess solution. Kept free of React so they're trivially unit-testable.
 */

export interface ReplayPly {
  from: string;
  to: string;
  /** FEN after this ply was played. */
  fenAfter: string;
}

/**
 * Replays a PGN move list and returns every ply's from/to squares and the FEN
 * after it. `null` when the PGN can't be parsed. Index 0 is the first ply.
 */
export function replayPgnVerbose(pgn: string): ReplayPly[] | null {
  try {
    const parser = new Chess();
    parser.loadPgn(pgn);
    const history = parser.history({ verbose: true });
    if (history.length === 0) return null;

    const board = new Chess();
    const plies: ReplayPly[] = [];
    for (const move of history) {
      const applied = board.move({ from: move.from, to: move.to, promotion: move.promotion });
      if (!applied) return null;
      plies.push({ from: move.from, to: move.to, fenAfter: board.fen() });
    }
    return plies;
  } catch {
    return null;
  }
}

/**
 * Replays a PGN for `plyCount` plies and returns the resulting FEN. Returns
 * `null` if the PGN is invalid or shorter than `plyCount`. `plyCount` of 0
 * returns the standard start position.
 */
export function replayPgnToFen(pgn: string, plyCount: number): string | null {
  if (plyCount < 0) return null;
  if (plyCount === 0) return new Chess().fen();
  const plies = replayPgnVerbose(pgn);
  if (!plies || plies.length < plyCount) return null;
  return plies[plyCount - 1].fenAfter;
}

/**
 * Even solution indices are the solver's moves; odd indices are the opponent's
 * scripted auto-responses.
 */
export function isSolverTurn(moveIndex: number): boolean {
  return moveIndex % 2 === 0;
}

const CASTLE_NORMALIZATION: Record<string, string> = {
  e1h1: 'e1g1',
  e8h8: 'e8g8',
  e1a1: 'e1c1',
  e8a8: 'e8c8',
};

/**
 * Normalizes the rook-square castling UCI Lichess sometimes emits into the
 * king-destination form chess.js produces (e1h1 → e1g1, e8a8 → e8c8, …).
 * Non-castling UCIs pass through unchanged.
 */
export function normalizeCastleUci(uci: string): string {
  return CASTLE_NORMALIZATION[uci] ?? uci;
}

/** Whether two UCIs are equivalent, accounting for castling normalization. */
export function uciMatch(played: string, expected: string): boolean {
  return normalizeCastleUci(played) === normalizeCastleUci(expected);
}

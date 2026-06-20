import { Chess } from 'chess.js';

/** Human-readable move text from a lichess opening-book PGN movetext. */
export function formatOpeningPgn(pgn: string): string {
  const text = pgn.trim();
  if (!text) return '';
  try {
    const chess = new Chess();
    chess.loadPgn(text);
    return chess.history().join(' ');
  } catch {
    return text;
  }
}
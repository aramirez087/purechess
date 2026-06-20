import { Chess } from 'chess.js';
import type { EcoEntry } from './eco';
import { ECO_OPENINGS } from './eco';

export type { EcoEntry };
export { ECO_OPENINGS };
export type { OpeningBook, OpeningEntry, OpeningFamily } from './opening-book';
export {
  buildOpeningBook,
  epdToStudyFen,
  getFamily,
  loadOpeningBook,
  parseOpeningEntry,
  searchOpenings,
} from './opening-book';

const fenCache = new Map<string, string>();

export function applyMoves(sanMoves: string): string {
  const chess = new Chess();
  for (const san of sanMoves.trim().split(/\s+/)) {
    chess.move(san);
  }
  return chess.fen();
}

export function getEcoFen(entry: EcoEntry): string {
  const cached = fenCache.get(entry.code + ':' + entry.moves);
  if (cached !== undefined) return cached;
  const fen = applyMoves(entry.moves);
  fenCache.set(entry.code + ':' + entry.moves, fen);
  return fen;
}

function normalizeFen(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

export function lookupByName(query: string): EcoEntry | undefined {
  const q = query.toLowerCase().trim();
  if (!q) return undefined;
  return ECO_OPENINGS.find(
    (e) => e.name.toLowerCase().includes(q) || e.code.toLowerCase().startsWith(q),
  );
}

export function lookupByFen(fen: string): EcoEntry | undefined {
  const normalTarget = normalizeFen(fen);
  return ECO_OPENINGS.find((e) => normalizeFen(getEcoFen(e)) === normalTarget);
}

export function randomOpening(): { fen: string; name: string; code: string } {
  const idx = Math.floor(Math.random() * ECO_OPENINGS.length);
  const entry = ECO_OPENINGS[idx];
  const fen = getEcoFen(entry);
  return { fen, name: entry.name, code: entry.code };
}

export function isValidFen(fen: string): boolean {
  const trimmed = fen.trim();
  if (!trimmed) return false;
  // A FEN must have exactly 6 space-separated fields.
  if (trimmed.split(/\s+/).length !== 6) return false;
  try {
    new Chess(trimmed);
    return true;
  } catch {
    return false;
  }
}

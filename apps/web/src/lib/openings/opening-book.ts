/**
 * Opening Lab index over the lichess chess-openings book (`/openings.json`).
 * Each entry is [epd, name] — the EPD is replayed to a study FEN by appending
 * halfmove/fullmove counters (same normalization as `use-opening-name.ts`).
 */

export interface OpeningEntry {
  epd: string;
  name: string;
  fen: string;
  /** Full lichess movetext from the start position (empty for legacy 2-tuples). */
  pgn: string;
  /** Top-level family, e.g. "Italian Game". */
  family: string;
  /** Sub-line after the first colon, e.g. "Two Knights Defense, Fegatello Attack". */
  variation: string;
}

export interface OpeningFamily {
  name: string;
  entries: OpeningEntry[];
}

export interface OpeningBook {
  entries: OpeningEntry[];
  families: OpeningFamily[];
  byEpd: Map<string, OpeningEntry>;
}

/** Legacy `[epd, name]` or current `[epd, name, pgn]`. */
type RawEntry = [string, string] | [string, string, string];

let cached: OpeningBook | null = null;
let pending: Promise<OpeningBook> | null = null;

/** EPD → full FEN for board display (counters are arbitrary for study). */
export function epdToStudyFen(epd: string): string {
  return `${epd} 0 1`;
}

export function parseOpeningEntry(raw: RawEntry): OpeningEntry {
  const [epd, name, pgn = ''] = raw;
  const colon = name.indexOf(': ');
  const family = colon >= 0 ? name.slice(0, colon) : name;
  const variation = colon >= 0 ? name.slice(colon + 2) : '';
  return { epd, name, fen: epdToStudyFen(epd), pgn, family, variation };
}

export function buildOpeningBook(raw: RawEntry[]): OpeningBook {
  const entries = raw.map(parseOpeningEntry);
  const byEpd = new Map(entries.map((e) => [e.epd, e]));

  const familyMap = new Map<string, OpeningEntry[]>();
  for (const entry of entries) {
    const list = familyMap.get(entry.family) ?? [];
    list.push(entry);
    familyMap.set(entry.family, list);
  }

  const families = [...familyMap.entries()]
    .map(([name, familyEntries]) => ({
      name,
      entries: familyEntries.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name));

  return { entries, families, byEpd };
}

/** Score search hits — lower is better. */
function searchScore(entry: OpeningEntry, q: string): number {
  const name = entry.name.toLowerCase();
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (entry.family.toLowerCase() === q) return 2;
  if (entry.variation.toLowerCase().includes(q)) return 3;
  if (name.includes(q)) return 4;
  return 99;
}

export function searchOpenings(book: OpeningBook, query: string, limit = 40): OpeningEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return book.entries
    .filter((e) => e.name.toLowerCase().includes(q) || e.family.toLowerCase().includes(q))
    .sort((a, b) => searchScore(a, q) - searchScore(b, q) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function getFamily(book: OpeningBook, familyName: string): OpeningFamily | undefined {
  return book.families.find((f) => f.name.toLowerCase() === familyName.trim().toLowerCase());
}

export function loadOpeningBook(): Promise<OpeningBook> {
  if (cached) return Promise.resolve(cached);
  pending ??= fetch('/openings.json')
    .then((res) => {
      if (!res.ok) throw new Error(`openings.json ${res.status}`);
      return res.json() as Promise<RawEntry[]>;
    })
    .then((raw) => {
      cached = buildOpeningBook(raw);
      return cached;
    })
    .catch((err) => {
      pending = null;
      throw err;
    });
  return pending;
}

/** Test-only: clears the module-scope cache between specs. */
export function __resetOpeningBookCache(): void {
  cached = null;
  pending = null;
}
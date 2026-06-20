import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RepertoireNodeDto } from '@purechess/shared';
import { parsePgnToTree } from '../repertoire/repertoire-tree';
import { STARTING_FEN } from '@purechess/shared';

export interface OpeningBookEntry {
  epd: string;
  name: string;
  pgn: string;
  family: string;
  variation: string;
}

export interface OpeningBookIndex {
  entries: OpeningBookEntry[];
  families: Map<string, OpeningBookEntry[]>;
  byEpd: Map<string, OpeningBookEntry>;
}

type RawRow = [string, string, string];

let cached: OpeningBookIndex | null = null;

function bookFilePath(): string {
  const candidates = [
    join(__dirname, 'data', 'openings-book.json'),
    join(process.cwd(), 'src', 'opening-lab', 'data', 'openings-book.json'),
    join(process.cwd(), 'apps', 'api', 'src', 'opening-lab', 'data', 'openings-book.json'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error('openings-book.json not found — run pnpm build:openings');
}

function parseRow([epd, name, pgn]: RawRow): OpeningBookEntry {
  const colon = name.indexOf(': ');
  const family = colon >= 0 ? name.slice(0, colon) : name;
  const variation = colon >= 0 ? name.slice(colon + 2) : '';
  return { epd, name, pgn, family, variation };
}

export function loadOpeningBookIndex(): OpeningBookIndex {
  if (cached) return cached;
  const raw = JSON.parse(readFileSync(bookFilePath(), 'utf8')) as RawRow[];
  const entries = raw.map(parseRow);
  const families = new Map<string, OpeningBookEntry[]>();
  const byEpd = new Map<string, OpeningBookEntry>();
  for (const entry of entries) {
    byEpd.set(entry.epd, entry);
    const list = families.get(entry.family) ?? [];
    list.push(entry);
    families.set(entry.family, list);
  }
  cached = { entries, families, byEpd };
  return cached;
}

/** Mainline plies from a book PGN (children[0] chain). */
export function mainlineStepsFromPgn(pgn: string): {
  rootFen: string;
  steps: Array<{ san: string; uci: string; fen: string }>;
} {
  try {
    const root = parsePgnToTree(pgn) as RepertoireNodeDto;
    const steps: Array<{ san: string; uci: string; fen: string }> = [];
    let node: RepertoireNodeDto | undefined = root.children[0];
    while (node) {
      steps.push({ san: node.san, uci: node.uci, fen: node.fen });
      node = node.children[0];
    }
    return { rootFen: root.fen, steps };
  } catch {
    return { rootFen: STARTING_FEN, steps: [] };
  }
}

export function getFamilyEntries(familyName: string): OpeningBookEntry[] {
  const book = loadOpeningBookIndex();
  const key = [...book.families.keys()].find(
    (f) => f.toLowerCase() === familyName.trim().toLowerCase(),
  );
  return key ? (book.families.get(key) ?? []) : [];
}

/** Test-only */
export function __resetOpeningLabBookCache(): void {
  cached = null;
}
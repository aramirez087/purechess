/**
 * Bakes the lichess opening book to openings.json as a compact
 * [["epd","name","pgn"], …] array (~3.7k entries) for lazy lookup by
 * apps/web/src/hooks/use-opening-name.ts and the Opening Lab.
 *
 * The upstream TSV is `eco\tname\tpgn` (the epd/uci columns were dropped
 * upstream), so the EPD is derived by replaying each PGN with chess.js —
 * which also matches the runtime normalization, since the analysis board
 * produces its FENs with the same chess.js.
 *
 * Run once when refreshing the book: `pnpm build:openings` (network access
 * required); commit the regenerated openings.json.
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// chess.js lives in apps/web's dependency tree, not the workspace root.
const require = createRequire(
  new URL('../apps/web/package.json', import.meta.url),
);
const { Chess } = require('chess.js');

const FILES = ['a', 'b', 'c', 'd', 'e'];
const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATHS = [
  path.join(ROOT, '../apps/web/public/openings.json'),
  path.join(ROOT, '../apps/api/src/opening-lab/data/openings-book.json'),
];

function epdFromPgn(pgn) {
  const chess = new Chess();
  chess.loadPgn(pgn);
  return chess.fen().split(' ').slice(0, 4).join(' ');
}

/** @type {Map<string, { name: string, pgn: string }>} */
const entries = new Map();
let skipped = 0;

for (const file of FILES) {
  const res = await fetch(`${BASE}/${file}.tsv`);
  if (!res.ok) throw new Error(`${file}.tsv: HTTP ${res.status}`);
  const lines = (await res.text()).trim().split('\n');
  for (const line of lines.slice(1)) {
    const [, name, pgn] = line.split('\t');
    if (!name || !pgn) continue;
    try {
      const epd = epdFromPgn(pgn);
      // Transpositions: keep the first (most general) name for a position.
      if (!entries.has(epd)) entries.set(epd, { name, pgn });
    } catch {
      skipped += 1;
    }
  }
}

if (entries.size < 3000) {
  throw new Error(`only ${entries.size} openings parsed — upstream format change?`);
}

const payload = JSON.stringify([...entries.entries()].map(([epd, { name, pgn }]) => [epd, name, pgn]));
for (const out of OUT_PATHS) {
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, payload, 'utf8');
  console.log(`wrote ${entries.size} openings to ${path.relative(process.cwd(), out)} (${skipped} skipped)`);
}

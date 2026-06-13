/**
 * seed-puzzles.ts — ingest the lichess CC0 puzzle dump into our own Postgres.
 *
 * Usage:
 *   pnpm db:seed-puzzles ./lichess_db_puzzle.csv --count 50000 [--min-popularity 80]
 *
 * The real dump is ~4M rows / multi-GB, so we NEVER load it all into memory:
 * the file is streamed line-by-line (createReadStream + readline). To keep the
 * top --count rows by Popularity in O(count) memory (not O(rows)) we maintain a
 * bounded MIN-HEAP of size --count keyed on popularity: every incoming row is
 * compared against the heap root (the current weakest kept row); once the heap
 * is full we only admit a row if it beats the root, evicting the root. After the
 * stream ends the heap holds exactly the top --count rows by popularity. Rows
 * are then inserted in batches of 1000 via `createMany({ skipDuplicates: true })`
 * so re-runs are idempotent (id = lichess PuzzleId is the PK).
 *
 * The pure helpers (parseRow / validateHeader / PopularityHeap) carry NO DB
 * dependency so they are unit-tested directly in test/puzzles/seed-puzzles.spec.ts.
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { PrismaClient } from '@prisma/client';

/** A parsed, validated puzzle row ready for `prisma.puzzle.createMany`. */
export interface ParsedPuzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  ratingDeviation: number;
  popularity: number;
  plays: number;
  themes: string[];
  openingTags: string[];
}

/** The exact lichess dump header. Column order is positional, so we pin it. */
export const LICHESS_HEADER =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags';

const RUNBOOK_HINT =
  'See docs/runbooks/puzzle-db-refresh.md for the dump download + format.';

/**
 * Validate the first CSV line is the lichess header we expect. Returns true on
 * match; the caller decides how to fail. Pure — no I/O.
 */
export function validateHeader(headerLine: string): boolean {
  return headerLine.trim() === LICHESS_HEADER;
}

/** Coerce a CSV cell to a finite int, defaulting to 0 for empty/garbage. */
function toInt(cell: string | undefined): number {
  const n = Number.parseInt((cell ?? '').trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Split a space-delimited cell into a clean token array (drops empties). */
function splitTokens(cell: string | undefined): string[] {
  return (cell ?? '')
    .trim()
    .split(' ')
    .filter((t) => t.length > 0);
}

/**
 * Parse one CSV data line into a ParsedPuzzle, or return null to SKIP a
 * malformed/empty row. We skip when: too few columns, empty PuzzleId, empty
 * FEN, or empty Moves — those rows can never produce a playable puzzle.
 *
 * Columns (positional):
 *   0 PuzzleId, 1 FEN, 2 Moves, 3 Rating, 4 RatingDeviation,
 *   5 Popularity, 6 NbPlays, 7 Themes, 8 GameUrl, 9 OpeningTags
 *
 * Pure — no I/O, no DB. Unit-tested directly.
 */
export function parseRow(line: string): ParsedPuzzle | null {
  if (!line || line.trim().length === 0) return null;
  const cols = line.split(',');
  if (cols.length < 8) return null;

  const id = (cols[0] ?? '').trim();
  const fen = (cols[1] ?? '').trim();
  const moves = splitTokens(cols[2]);

  // Drop rows that can never be a playable puzzle.
  if (!id || !fen || moves.length === 0) return null;

  return {
    id,
    fen,
    moves,
    rating: toInt(cols[3]),
    ratingDeviation: toInt(cols[4]),
    popularity: toInt(cols[5]),
    plays: toInt(cols[6]),
    themes: splitTokens(cols[7]),
    openingTags: splitTokens(cols[9]),
  };
}

/**
 * Bounded min-heap that keeps the top-`capacity` puzzles by popularity in
 * O(capacity) memory. The root is always the weakest kept row, so the admission
 * test is a single comparison against the root. Pure data structure — no I/O.
 *
 * Ties on popularity are broken by `plays` so the kept set is deterministic.
 */
export class PopularityHeap {
  private readonly items: ParsedPuzzle[] = [];

  constructor(private readonly capacity: number) {
    if (capacity < 1) throw new Error('PopularityHeap capacity must be >= 1');
  }

  /** Order: lower popularity (then lower plays) is "smaller" → sits at root. */
  private less(a: ParsedPuzzle, b: ParsedPuzzle): boolean {
    if (a.popularity !== b.popularity) return a.popularity < b.popularity;
    return a.plays < b.plays;
  }

  private swap(i: number, j: number): void {
    const t = this.items[i]!;
    this.items[i] = this.items[j]!;
    this.items[j] = t;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.less(this.items[i]!, this.items[parent]!)) {
        this.swap(i, parent);
        i = parent;
      } else break;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.items.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < n && this.less(this.items[l]!, this.items[smallest]!)) smallest = l;
      if (r < n && this.less(this.items[r]!, this.items[smallest]!)) smallest = r;
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  /** Admit a row if there is room or it beats the current weakest kept row. */
  push(p: ParsedPuzzle): void {
    if (this.items.length < this.capacity) {
      this.items.push(p);
      this.bubbleUp(this.items.length - 1);
      return;
    }
    const root = this.items[0]!;
    // Strictly-greater beats the weakest; equal keeps the incumbent (stable).
    if (this.less(root, p)) {
      this.items[0] = p;
      this.bubbleDown(0);
    }
  }

  get size(): number {
    return this.items.length;
  }

  /** Snapshot of the kept rows (unsorted heap order). */
  values(): ParsedPuzzle[] {
    return [...this.items];
  }

  /** Kept rows sorted by popularity DESC (then plays DESC) — insertion order. */
  toSortedDesc(): ParsedPuzzle[] {
    return [...this.items].sort((a, b) =>
      b.popularity !== a.popularity ? b.popularity - a.popularity : b.plays - a.plays,
    );
  }
}

export interface SeedOptions {
  filePath: string;
  count: number;
  minPopularity: number;
}

/** Parse argv (after the node + script tokens) into SeedOptions. */
export function parseArgs(argv: string[]): SeedOptions {
  let filePath: string | undefined;
  let count = 50000;
  let minPopularity = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--count') {
      count = toInt(argv[++i]);
    } else if (arg === '--min-popularity') {
      minPopularity = toInt(argv[++i]);
    } else if (arg.startsWith('--count=')) {
      count = toInt(arg.slice('--count='.length));
    } else if (arg.startsWith('--min-popularity=')) {
      minPopularity = toInt(arg.slice('--min-popularity='.length));
    } else if (!arg.startsWith('--')) {
      filePath = arg;
    }
  }

  if (!filePath) {
    throw new Error(
      `No CSV path given.\nUsage: pnpm db:seed-puzzles <file.csv> --count 50000 [--min-popularity 80]\n${RUNBOOK_HINT}`,
    );
  }
  if (count < 1) throw new Error('--count must be >= 1');

  return { filePath, count, minPopularity };
}

const BATCH_SIZE = 1000;
const PROGRESS_EVERY = 10000;

/**
 * Stream the CSV, select the top-`count` rows by popularity into a bounded heap,
 * then batch-insert them idempotently. Returns the number of rows the DB
 * reported as newly inserted (skipDuplicates makes re-runs return ~0).
 */
async function runSeed(opts: SeedOptions, prisma: PrismaClient): Promise<void> {
  const { existsSync } = await import('node:fs');
  if (!existsSync(opts.filePath)) {
    throw new Error(`Puzzle CSV not found at "${opts.filePath}".\n${RUNBOOK_HINT}`);
  }

  const stream = createReadStream(opts.filePath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  const heap = new PopularityHeap(opts.count);
  let lineNo = 0;
  let kept = 0;
  let scanned = 0;

  for await (const line of rl) {
    lineNo++;
    if (lineNo === 1) {
      if (!validateHeader(line)) {
        rl.close();
        stream.destroy();
        throw new Error(
          `Malformed header. Expected:\n  ${LICHESS_HEADER}\nGot:\n  ${line.trim()}\n${RUNBOOK_HINT}`,
        );
      }
      continue;
    }

    const parsed = parseRow(line);
    if (!parsed) continue;
    if (parsed.popularity < opts.minPopularity) continue;

    scanned++;
    heap.push(parsed);
    if (scanned % PROGRESS_EVERY === 0) {
      console.log(`  scanned ${scanned} eligible rows, holding top ${heap.size}…`);
    }
  }

  const selected = heap.toSortedDesc();
  console.log(`Selected ${selected.length} puzzles (top ${opts.count} by popularity).`);

  for (let i = 0; i < selected.length; i += BATCH_SIZE) {
    const batch = selected.slice(i, i + BATCH_SIZE);
    const res = await prisma.puzzle.createMany({ data: batch, skipDuplicates: true });
    kept += res.count;
    if ((i + BATCH_SIZE) % PROGRESS_EVERY === 0 || i + BATCH_SIZE >= selected.length) {
      console.log(`  inserted ${Math.min(i + BATCH_SIZE, selected.length)}/${selected.length} (new: ${kept})`);
    }
  }

  console.log(`Done. ${kept} new rows inserted (${selected.length - kept} already present).`);
}

/** CLI entrypoint. Kept separate from runSeed so tests can drive runSeed alone. */
async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    await runSeed(opts, prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when invoked directly (not when imported by tests). Under ts-node the
// entry module's URL ends with this file's path.
const isDirectRun =
  typeof process.argv[1] === 'string' && process.argv[1].endsWith('seed-puzzles.ts');
if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error(`\nseed-puzzles failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}

export { runSeed };

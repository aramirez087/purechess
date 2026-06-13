/**
 * gen-synthetic-puzzles.ts — generate a synthetic lichess-format puzzle CSV for
 * local perf/scale testing when the real CC0 dump is not present.
 *
 * Usage:
 *   pnpm exec ts-node --project tsconfig.seed.json scripts/gen-synthetic-puzzles.ts <out.csv> [--count 50000]
 *
 * The output uses the EXACT lichess dump header so it feeds the existing
 * `seed-puzzles.ts` ingester unchanged:
 *   PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
 *
 * Ratings are spread 600-2800 (skewed toward the 1200-1900 mass like the real
 * dump), themes are drawn from the real lichess theme vocabulary (1-4 per row),
 * popularity 0-100. The FEN/Moves are NOT guaranteed to be a real tactic — this
 * file exists ONLY to populate the bank at production volume so the selection
 * queries and indexes can be measured at scale. Real solvable puzzles for E2E
 * are seeded separately (scripts/seed-e2e-fixtures.ts).
 *
 * NEVER commit the generated CSV — it is covered by .gitignore (*.puzzle.csv)
 * and we write to a path the operator chooses (use /tmp locally).
 */
import { createWriteStream } from 'node:fs';
import { LICHESS_HEADER } from './seed-puzzles';

/** Real lichess theme slugs, weighted loosely by how common they are. */
const THEMES = [
  'advantage',
  'crushing',
  'endgame',
  'middlegame',
  'opening',
  'short',
  'long',
  'oneMove',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'doubleCheck',
  'sacrifice',
  'deflection',
  'attraction',
  'clearance',
  'interference',
  'xRayAttack',
  'hangingPiece',
  'trappedPiece',
  'mate',
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'backRankMate',
  'smotheredMate',
  'anastasiaMate',
  'bodenMate',
  'doubleBishopMate',
  'kingsideAttack',
  'queensideAttack',
  'defensiveMove',
  'quietMove',
  'zugzwang',
  'promotion',
  'underPromotion',
  'enPassant',
  'castling',
  'capturingDefender',
  'intermezzo',
  'rookEndgame',
  'pawnEndgame',
  'queenEndgame',
  'bishopEndgame',
  'knightEndgame',
  'queenRookEndgame',
  'master',
  'masterVsMaster',
  'superGM',
] as const;

/**
 * A pool of real legal positions, each PAIRED with a legal first move (UCI). The
 * paired move is the row's single-move "solution" so a synthetic puzzle is
 * actually solvable in the local solve loop (`useLocalPuzzle` checks moves[0] by
 * uciMatch). The moves were derived as the first legal move from each FEN with
 * chess.js (see scripts/seed-e2e-fixtures.ts for the verification approach).
 */
const FEN_POOL: { fen: string; move: string }[] = [
  { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', move: 'a8b8' },
  { fen: 'r2q1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8', move: 'c4b5' },
  { fen: '2r3k1/5ppp/p2p4/1p1Pp3/1P2P3/P5P1/5P1P/2R3K1 w - - 0 24', move: 'a3a4' },
  { fen: 'r3k2r/pbpnqppp/1p2pn2/3p4/2PP4/1PN1PN2/PB3PPP/R2QK2R w KQkq - 2 10', move: 'c4c5' },
  { fen: '8/8/4kp2/3p4/3P4/4K3/8/8 w - - 0 1', move: 'e3f4' },
  { fen: 'r1b1k2r/ppppnppp/2n2q2/8/1bB1P3/2N2N2/PPP2PPP/R1BQK2R w KQkq - 5 7', move: 'c4b5' },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', move: 'f2f3' },
  { fen: '2kr3r/ppp2ppp/2n5/3qp3/3P4/2P2N2/PP3PPP/RNBQ1RK1 w - - 0 9', move: 'd4e5' },
  { fen: 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5', move: 'd4b5' },
  { fen: '4r1k1/pp3ppp/2p5/8/2P5/1P3P2/P5PP/4R1K1 b - - 0 20', move: 'e8f8' },
];

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Skewed rating in [600, 2800], mass around 1200-1900 (triangular-ish). */
function sampleRating(rnd: () => number): number {
  const r = (rnd() + rnd() + rnd()) / 3; // sum-of-3 → bell around 0.5
  return Math.round(600 + r * 2200);
}

function pickThemes(rnd: () => number): string[] {
  const n = 1 + Math.floor(rnd() * 4); // 1..4 themes
  const out = new Set<string>();
  while (out.size < n) {
    out.add(THEMES[Math.floor(rnd() * THEMES.length)]!);
  }
  return [...out];
}

function parseArgs(argv: string[]): { out: string; count: number } {
  let out: string | undefined;
  let count = 50000;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--count') count = Number.parseInt(argv[++i] ?? '50000', 10);
    else if (a.startsWith('--count=')) count = Number.parseInt(a.slice(8), 10);
    else if (!a.startsWith('--')) out = a;
  }
  if (!out) throw new Error('Usage: gen-synthetic-puzzles.ts <out.csv> [--count N]');
  if (!Number.isFinite(count) || count < 1) throw new Error('--count must be >= 1');
  return { out, count };
}

async function main(): Promise<void> {
  const { out, count } = parseArgs(process.argv.slice(2));
  const rnd = mulberry32(0xc0ffee);
  const ws = createWriteStream(out, { encoding: 'utf8' });

  const write = (s: string): Promise<void> =>
    new Promise((resolve, reject) => {
      if (!ws.write(s)) ws.once('drain', () => resolve());
      else resolve();
      ws.once('error', reject);
    });

  await write(LICHESS_HEADER + '\n');
  for (let i = 0; i < count; i++) {
    const id = `SYN${i.toString(36).padStart(6, '0')}`;
    const slot = FEN_POOL[i % FEN_POOL.length]!;
    const fen = slot.fen;
    const moves = slot.move; // single legal solver move → puzzle is solvable
    const rating = sampleRating(rnd);
    const ratingDeviation = 50 + Math.floor(rnd() * 90);
    const popularity = Math.floor(rnd() * 101);
    const nbPlays = Math.floor(rnd() * 5000);
    const themes = pickThemes(rnd).join(' ');
    const gameUrl = `https://lichess.org/${id}`;
    const opening = rnd() < 0.25 ? 'Italian_Game Italian_Game_Classical_Variation' : '';
    await write(
      `${id},${fen},${moves},${rating},${ratingDeviation},${popularity},${nbPlays},${themes},${gameUrl},${opening}\n`,
    );
    if ((i + 1) % 50000 === 0) console.log(`  generated ${i + 1} rows…`);
  }

  await new Promise<void>((resolve) => ws.end(resolve));
  console.log(`Wrote ${count} synthetic puzzle rows to ${out}`);
}

main().catch((err: unknown) => {
  console.error(`gen-synthetic-puzzles failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

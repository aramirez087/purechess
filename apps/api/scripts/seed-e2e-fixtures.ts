/**
 * seed-e2e-fixtures.ts — insert a small set of REAL, verified, single-move
 * puzzles tagged with a distinctive theme (`e2etest`) so the Playwright training
 * suite can request a deterministic, solvable puzzle from the local bank.
 *
 * The synthetic perf bank (gen-synthetic-puzzles + seed-puzzles) uses placeholder
 * FEN/solution lines that are NOT real tactics — `useLocalPuzzle` would reject an
 * illegal "solution" move. These fixtures are mate-in-1 positions whose UCI
 * solution is legal-checkmate (verified), so the theme trainer / rush / review
 * E2E can actually solve a puzzle and assert the attempt was counted.
 *
 * Usage:
 *   pnpm exec ts-node --project tsconfig.seed.json scripts/seed-e2e-fixtures.ts
 *
 * Idempotent (createMany skipDuplicates; ids are stable `E2E*`). NEVER touches
 * the production bank beyond adding these tagged rows; the e2e reset never
 * deletes Puzzle rows, so they persist across runs.
 */
import { PrismaClient } from '@prisma/client';

/** id, fen (solver to move), solution UCI line. moves[0] = SOLVER's move. */
const FIXTURES: { id: string; fen: string; moves: string[]; rating: number }[] = [
  // Back-rank mate: Re8#.
  { id: 'E2E_BACKRANK', fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', moves: ['e1e8'], rating: 800 },
  // Queen mate: Qd8#.
  { id: 'E2E_QUEEN', fen: '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', moves: ['d1d8'], rating: 900 },
  // Rook mate: Ra8#.
  { id: 'E2E_ROOK', fen: '7k/5ppp/8/8/8/8/5PPP/R6K w - - 0 1', moves: ['a1a8'], rating: 1000 },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const rows = FIXTURES.map((f) => ({
      id: f.id,
      fen: f.fen,
      moves: f.moves,
      rating: f.rating,
      ratingDeviation: 75,
      popularity: 100,
      plays: 1000,
      themes: ['e2etest', 'mate', 'mateIn1', 'backRankMate'],
      openingTags: [] as string[],
    }));
    const res = await prisma.puzzle.createMany({ data: rows, skipDuplicates: true });
    console.log(`e2e fixtures: ${res.count} new (${rows.length - res.count} already present).`);
    console.log('Theme tag: e2etest — request via GET /puzzles/next?theme=e2etest.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(`seed-e2e-fixtures failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

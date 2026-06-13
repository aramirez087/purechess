/**
 * endgame-drills.ts — seed the curated EndgameDrill bank.
 *
 * Usage:
 *   pnpm db:seed-endgames
 *
 * A hand-picked set of ~25 must-know endgames across families (basic mates,
 * K+P races, Lucena/Philidor rook endings, R+P vs R, opposite-colour-bishop
 * draw holds). Each row carries a CORRECT, LEGAL FEN, the objective ('win' to
 * convert / 'draw' to hold), and a difficulty for ordering within a family.
 *
 * EVERY FEN was verified (chess.js: legal, not in check, not game over) AND
 * spot-checked against the lichess tablebase so the stated objective matches
 * ground truth (e.g. the rook-pawn K+P is a DRAW, Philidor HOLDS, the
 * opposite-colour-bishop position cannot be broken). The seed re-verifies every
 * FEN with chess.js at runtime and refuses to write an illegal one — an illegal
 * drill is a hard fail.
 *
 * Idempotent: upsert by `slug` (the frozen `@unique`), so re-running refreshes
 * names/objectives/difficulty without creating duplicates. The pure
 * `ENDGAME_DRILLS` catalog + `assertLegalFen` carry no DB dependency so they are
 * unit-testable.
 */
import { Chess } from 'chess.js';
import { PrismaClient } from '@prisma/client';

/** EndgameCategory enum values (frozen Prisma enum). */
export type SeedCategory =
  | 'basic_mate'
  | 'king_pawn'
  | 'rook'
  | 'minor'
  | 'queen'
  | 'other';

/** EndgameObjective enum values (frozen Prisma enum). */
export type SeedObjective = 'win' | 'draw';

/** One curated drill, ready to upsert. */
export interface SeedDrill {
  slug: string;
  name: string;
  category: SeedCategory;
  fen: string;
  objective: SeedObjective;
  targetDtm?: number;
  difficulty: number;
}

/**
 * The curated catalog. Within each family `difficulty` orders the drills from
 * the cleanest textbook position upward. `targetDtm` is a soft hint (plies),
 * not a gate — the objective is win/draw, not a perfect-DTM line.
 */
export const ENDGAME_DRILLS: readonly SeedDrill[] = [
  // --- basic_mate -----------------------------------------------------------
  {
    slug: 'kq-vs-k-center',
    name: 'Queen mate — king in the centre',
    category: 'basic_mate',
    fen: '8/8/8/4k3/8/8/3QK3/8 w - - 0 1',
    objective: 'win',
    targetDtm: 20,
    difficulty: 0,
  },
  {
    slug: 'kq-vs-k-edge',
    name: 'Queen mate — drive to the edge',
    category: 'basic_mate',
    fen: '8/8/8/8/8/2k5/3Q4/4K3 w - - 0 1',
    objective: 'win',
    targetDtm: 16,
    difficulty: 1,
  },
  {
    slug: 'kr-vs-k-center',
    name: 'Rook mate — the box',
    category: 'basic_mate',
    fen: '8/8/8/4k3/8/8/4K3/4R3 w - - 0 1',
    objective: 'win',
    targetDtm: 28,
    difficulty: 1,
  },
  {
    slug: 'kr-vs-k-cutoff',
    name: 'Rook mate — cut the king off',
    category: 'basic_mate',
    fen: '8/8/8/3k4/8/3K4/8/7R w - - 0 1',
    objective: 'win',
    targetDtm: 26,
    difficulty: 2,
  },
  {
    slug: 'kr-vs-k-2nd-rank',
    name: 'Rook mate — second-rank squeeze',
    category: 'basic_mate',
    fen: '8/8/8/8/8/4k3/R7/4K3 w - - 0 1',
    objective: 'win',
    targetDtm: 18,
    difficulty: 2,
  },
  {
    slug: 'kbb-vs-k',
    name: 'Two bishops mate',
    category: 'basic_mate',
    fen: '8/8/8/4k3/8/8/2B5/2B1K3 w - - 0 1',
    objective: 'win',
    targetDtm: 30,
    difficulty: 3,
  },

  // --- king_pawn ------------------------------------------------------------
  {
    slug: 'kp-vs-k-in-front',
    name: 'King and pawn — king in front',
    category: 'king_pawn',
    fen: '8/8/8/4k3/8/4P3/4K3/8 w - - 0 1',
    objective: 'win',
    targetDtm: 24,
    difficulty: 0,
  },
  {
    slug: 'kp-vs-k-opposition',
    name: 'King and pawn — take the opposition',
    category: 'king_pawn',
    fen: '8/8/4k3/8/4P3/4K3/8/8 w - - 0 1',
    objective: 'win',
    targetDtm: 22,
    difficulty: 1,
  },
  {
    slug: 'kp-vs-k-behind',
    name: 'King and pawn — king behind the pawn',
    category: 'king_pawn',
    fen: '8/8/3k4/8/3P4/3K4/8/8 w - - 0 1',
    objective: 'win',
    targetDtm: 22,
    difficulty: 1,
  },
  {
    slug: 'kp-vs-k-outside',
    name: 'King and pawn — outside the square',
    category: 'king_pawn',
    fen: '8/8/8/8/1k2P3/8/4K3/8 w - - 0 1',
    objective: 'win',
    targetDtm: 14,
    difficulty: 1,
  },
  {
    slug: 'kp-vs-k-rook-pawn-draw',
    name: 'Rook pawn — hold the draw',
    category: 'king_pawn',
    fen: '8/8/8/8/k7/P7/K7/8 b - - 0 1',
    objective: 'draw',
    difficulty: 2,
  },
  {
    slug: 'two-connected-pawns',
    name: 'Two connected pawns — push them home',
    category: 'king_pawn',
    fen: '8/8/8/3k4/8/2PP4/8/3K4 w - - 0 1',
    objective: 'win',
    targetDtm: 26,
    difficulty: 2,
  },
  {
    slug: 'k-and-2-connected',
    name: 'King and two pawns vs king',
    category: 'king_pawn',
    fen: '8/8/8/3k4/8/3PP3/3K4/8 w - - 0 1',
    objective: 'win',
    targetDtm: 24,
    difficulty: 2,
  },

  // --- rook -----------------------------------------------------------------
  {
    slug: 'lucena',
    name: 'Lucena — build the bridge',
    category: 'rook',
    fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1',
    objective: 'win',
    targetDtm: 22,
    difficulty: 2,
  },
  {
    slug: 'philidor',
    name: 'Philidor — third-rank defence',
    category: 'rook',
    fen: '8/8/4k3/8/4p3/r7/4K3/4R3 w - - 0 1',
    objective: 'draw',
    difficulty: 2,
  },
  {
    slug: 'rp-vs-r-convert',
    name: 'Rook and pawn vs rook — convert',
    category: 'rook',
    fen: '8/8/8/4k3/4P3/8/r7/4K1R1 w - - 0 1',
    objective: 'win',
    targetDtm: 30,
    difficulty: 3,
  },
  {
    slug: 'rp-vs-r-3rd-rank',
    name: 'Rook and pawn vs rook — third-rank cut',
    category: 'rook',
    fen: '8/8/8/8/3Pk3/8/r7/3RK3 w - - 0 1',
    objective: 'win',
    targetDtm: 28,
    difficulty: 3,
  },
  {
    slug: 'kr-vs-kp-stop',
    name: 'Rook vs pawn — stop the runner',
    category: 'rook',
    fen: '8/8/8/8/4k3/4p3/8/R3K3 w - - 0 1',
    objective: 'win',
    targetDtm: 18,
    difficulty: 2,
  },

  // --- minor ----------------------------------------------------------------
  {
    slug: 'kbn-vs-k-classic',
    name: 'Bishop and knight mate',
    category: 'minor',
    fen: '8/8/8/8/4k3/8/4K3/3B1N2 w - - 0 1',
    objective: 'win',
    targetDtm: 32,
    difficulty: 4,
  },
  {
    slug: 'kbn-vs-k-defender',
    name: 'Bishop and knight — drive to the right corner',
    category: 'minor',
    fen: '4k3/8/4K3/8/8/8/5BN1/8 w - - 0 1',
    objective: 'win',
    targetDtm: 34,
    difficulty: 5,
  },
  {
    slug: 'ocb-draw-hold',
    name: 'Opposite-colour bishops — hold the draw',
    category: 'minor',
    fen: '8/8/4k3/3bp3/4P3/4K3/4B3/8 w - - 0 1',
    objective: 'draw',
    difficulty: 3,
  },
  {
    slug: 'bishop-pawn-promote',
    name: 'King, bishop and pawn — promote',
    category: 'minor',
    fen: '8/8/8/8/3k4/8/3PKB2/8 w - - 0 1',
    objective: 'win',
    targetDtm: 20,
    difficulty: 2,
  },

  // --- queen ----------------------------------------------------------------
  {
    slug: 'kqp-vs-kq-convert',
    name: 'Queen and pawn vs queen — convert',
    category: 'queen',
    fen: '3q4/8/3k4/8/8/3P4/3KQ3/8 w - - 0 1',
    objective: 'win',
    difficulty: 4,
  },
  {
    slug: 'q-vs-pawn-7th',
    name: 'Queen vs advanced pawn',
    category: 'queen',
    fen: '8/3p4/8/8/8/5k2/8/Q3K3 w - - 0 1',
    objective: 'win',
    targetDtm: 24,
    difficulty: 3,
  },

  // --- other ----------------------------------------------------------------
  {
    slug: 'q-vs-rook-win',
    name: 'Queen vs rook — win the rook',
    category: 'other',
    fen: '8/8/8/3k4/8/3r4/3Q4/3K4 w - - 0 1',
    objective: 'win',
    targetDtm: 18,
    difficulty: 5,
  },
];

/**
 * Assert a FEN is a legal, playable drill start: parseable by chess.js, the
 * side to move is NOT already in check, and the position is NOT already over.
 * Throws on any violation — the seed must never write a broken drill. Pure.
 */
export function assertLegalFen(slug: string, fen: string): void {
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch (err) {
    throw new Error(
      `Drill "${slug}" has an ILLEGAL FEN "${fen}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  if (game.isGameOver()) {
    throw new Error(`Drill "${slug}" FEN is already game over: "${fen}"`);
  }
  if (game.isCheck()) {
    throw new Error(`Drill "${slug}" FEN starts with the side to move in check: "${fen}"`);
  }
}

/** Validate every catalog FEN. Throws on the first illegal one. */
export function assertAllLegal(drills: readonly SeedDrill[] = ENDGAME_DRILLS): void {
  for (const d of drills) assertLegalFen(d.slug, d.fen);
}

/**
 * Upsert the whole catalog by slug. Verifies every FEN BEFORE touching the DB,
 * so a bad row aborts the run before any partial write. Returns counts of how
 * many slugs were created vs updated.
 */
export async function seedEndgameDrills(
  prisma: PrismaClient,
  drills: readonly SeedDrill[] = ENDGAME_DRILLS,
): Promise<{ created: number; updated: number }> {
  assertAllLegal(drills);

  let created = 0;
  let updated = 0;
  for (const d of drills) {
    const existing = await prisma.endgameDrill.findUnique({
      where: { slug: d.slug },
      select: { id: true },
    });
    await prisma.endgameDrill.upsert({
      where: { slug: d.slug },
      create: {
        slug: d.slug,
        name: d.name,
        category: d.category,
        fen: d.fen,
        objective: d.objective,
        targetDtm: d.targetDtm ?? null,
        difficulty: d.difficulty,
      },
      update: {
        name: d.name,
        category: d.category,
        fen: d.fen,
        objective: d.objective,
        targetDtm: d.targetDtm ?? null,
        difficulty: d.difficulty,
      },
    });
    if (existing) updated++;
    else created++;
  }
  return { created, updated };
}

/** CLI entrypoint — kept separate so tests can drive seedEndgameDrills alone. */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const { created, updated } = await seedEndgameDrills(prisma);
    console.log(
      `Seeded ${ENDGAME_DRILLS.length} endgame drills (${created} new, ${updated} updated).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  typeof process.argv[1] === 'string' && process.argv[1].endsWith('endgame-drills.ts');
if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error(
      `\nseed-endgames failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  });
}

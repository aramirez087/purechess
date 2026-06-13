/**
 * seed-perf-fixtures.ts — create ONE realistic user with a few hundred
 * PuzzleAttempts, some due PuzzleReviews, a Repertoire + RepertoireReviews,
 * EndgameAttempts, and a TrainingStreak/TrainingDay history. This gives the
 * selection-query EXPLAINs (getNext / getStats / getDue) real per-user volume to
 * plan against, and gives the E2E suite a populated account.
 *
 * Usage (after `pnpm db:seed-puzzles` has loaded the bank):
 *   pnpm exec ts-node --project tsconfig.seed.json scripts/seed-perf-fixtures.ts
 *     [--email perf@local.test] [--attempts 400]
 *
 * Idempotent on the user (upsert by email); attempts/reviews are recreated each
 * run (deleted-then-inserted for that user) so re-running gives a clean fixture.
 * NEVER seeds the production DB — it only writes one synthetic user. The user's
 * data cascades on user delete, so the e2e reset (which deletes Users) cleans it.
 */
import { PrismaClient } from '@prisma/client';

interface Args {
  email: string;
  username: string;
  attempts: number;
}

function parseArgs(argv: string[]): Args {
  let email = 'perf@local.test';
  let attempts = 400;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--email') email = argv[++i] ?? email;
    else if (a.startsWith('--email=')) email = a.slice(8);
    else if (a === '--attempts') attempts = Number.parseInt(argv[++i] ?? '400', 10);
    else if (a.startsWith('--attempts=')) attempts = Number.parseInt(a.slice(11), 10);
  }
  const username = email.split('@')[0]!.replace(/[^a-z0-9]/gi, '') || 'perfuser';
  return { email, username, attempts };
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main(): Promise<void> {
  const { email, username, attempts } = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const rnd = mulberry32(0x5eed16);
  try {
    const puzzleCount = await prisma.puzzle.count();
    if (puzzleCount < 1000) {
      throw new Error(
        `Only ${puzzleCount} puzzles in the bank. Run \`pnpm db:seed-puzzles <csv> --count 50000\` first.`,
      );
    }

    // 1) The user (upsert by email).
    const user = await prisma.user.upsert({
      where: { email },
      update: { username },
      create: { email, username, passwordHash: null },
    });
    console.log(`User ${user.username} (${user.id})`);

    // Clean this user's training data so the run is repeatable.
    await prisma.$transaction([
      prisma.puzzleAttempt.deleteMany({ where: { userId: user.id } }),
      prisma.puzzleReview.deleteMany({ where: { userId: user.id } }),
      prisma.repertoireReview.deleteMany({ where: { userId: user.id } }),
      prisma.repertoire.deleteMany({ where: { userId: user.id } }),
      prisma.endgameAttempt.deleteMany({ where: { userId: user.id } }),
      prisma.trainingDay.deleteMany({ where: { userId: user.id } }),
    ]);

    // 2) Pull a working set of real puzzles around a 1500-ish skill, spanning
    //    themes, to attach attempts/reviews to (real puzzleIds keep FKs valid).
    const pool = await prisma.puzzle.findMany({
      where: { rating: { gte: 900, lte: 2100 } },
      select: { id: true, rating: true, themes: true },
      take: attempts * 2,
      orderBy: { id: 'asc' },
    });
    if (pool.length < attempts) {
      throw new Error(`Working pool too small (${pool.length} < ${attempts}).`);
    }

    // 3) A few hundred attempts spread over the last 60 days, ~70% solved,
    //    sources spread across the modes, rating drifting upward slightly.
    const SOURCES = ['daily', 'theme', 'rush', 'review', 'mistake'] as const;
    let userRating = 1450;
    const attemptRows: {
      userId: string;
      puzzleId: string;
      solved: boolean;
      msToSolve: number;
      ratingBeforeUser: number;
      ratingAfterUser: number;
      source: (typeof SOURCES)[number];
      createdAt: Date;
    }[] = [];
    const now = Date.now();
    for (let i = 0; i < attempts; i++) {
      const p = pool[i]!;
      const solved = rnd() < 0.7;
      const before = Math.round(userRating);
      userRating += solved ? 4 + rnd() * 6 : -(5 + rnd() * 7);
      const after = Math.round(userRating);
      const daysAgo = Math.floor((1 - i / attempts) * 60); // oldest first
      attemptRows.push({
        userId: user.id,
        puzzleId: p.id,
        solved,
        msToSolve: 2000 + Math.floor(rnd() * 18000),
        ratingBeforeUser: before,
        ratingAfterUser: after,
        source: SOURCES[Math.floor(rnd() * SOURCES.length)]!,
        createdAt: new Date(now - daysAgo * 86400000 - Math.floor(rnd() * 3600000)),
      });
    }
    await prisma.puzzleAttempt.createMany({ data: attemptRows });
    console.log(`  ${attemptRows.length} puzzle attempts`);

    // 4) Puzzle Glicko row reflecting the drift.
    await prisma.puzzleRating.upsert({
      where: { userId: user.id },
      update: { rating: userRating, deviation: 80, volatility: 0.06 },
      create: { userId: user.id, rating: userRating, deviation: 80, volatility: 0.06 },
    });
    console.log(`  puzzle rating ≈ ${Math.round(userRating)}`);

    // 5) Due reviews: take 12 FAILED puzzles and enqueue, half due now/overdue.
    const failed = attemptRows.filter((a) => !a.solved).slice(0, 12);
    const reviewRows = failed.map((a, idx) => ({
      userId: user.id,
      puzzleId: a.puzzleId,
      dueAt: new Date(now + (idx < 6 ? -1 : 1) * (idx + 1) * 86400000), // 6 overdue, 6 future
      intervalDays: idx < 6 ? 1 : 3,
      easeFactor: 2.5,
      lapses: 1,
      reps: idx < 6 ? 1 : 2,
    }));
    // unique (userId, puzzleId) — dedupe puzzleIds just in case
    const seen = new Set<string>();
    const dedupedReviews = reviewRows.filter((r) =>
      seen.has(r.puzzleId) ? false : (seen.add(r.puzzleId), true),
    );
    await prisma.puzzleReview.createMany({ data: dedupedReviews });
    const dueNow = dedupedReviews.filter((r) => r.dueAt.getTime() <= now).length;
    console.log(`  ${dedupedReviews.length} reviews (${dueNow} due now)`);

    // 6) A repertoire (1.e4 e5 2.Nf3 Nc6 mainline) + one due drill line.
    const rep = await prisma.repertoire.create({
      data: {
        userId: user.id,
        name: 'Italian Game (White)',
        color: 'white',
        rootFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        treeJson: {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          san: '',
          uci: '',
          children: [
            {
              fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
              san: 'e4',
              uci: 'e2e4',
              children: [
                {
                  fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
                  san: 'e5',
                  uci: 'e7e5',
                  children: [
                    {
                      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
                      san: 'Nf3',
                      uci: 'g1f3',
                      children: [
                        {
                          fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
                          san: 'Nc6',
                          uci: 'b8c6',
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    });
    await prisma.repertoireReview.create({
      data: {
        userId: user.id,
        repertoireId: rep.id,
        nodePath: '0.0.0.0',
        dueAt: new Date(now - 2 * 86400000), // overdue
        intervalDays: 1,
        easeFactor: 2.5,
        reps: 1,
        lapses: 0,
      },
    });
    console.log(`  repertoire "${rep.name}" + 1 due line`);

    // 7) Endgame attempts: a couple solved, a couple attempted-but-failed (gaps).
    const drills = await prisma.endgameDrill.findMany({ select: { id: true }, take: 5 });
    if (drills.length >= 4) {
      await prisma.endgameAttempt.createMany({
        data: [
          { userId: user.id, drillId: drills[0]!.id, succeeded: true, movesPlayed: 6 },
          { userId: user.id, drillId: drills[1]!.id, succeeded: true, movesPlayed: 9 },
          { userId: user.id, drillId: drills[2]!.id, succeeded: false, movesPlayed: 14 },
          { userId: user.id, drillId: drills[3]!.id, succeeded: false, movesPlayed: 11 },
        ],
      });
      console.log(`  4 endgame attempts (2 solved, 2 gaps)`);
    }

    // 8) Training streak + daily history (last 14 days active).
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await prisma.trainingStreak.upsert({
      where: { userId: user.id },
      update: { currentStreak: 7, longestStreak: 12, lastTrainedOn: today, dailyGoalPuzzles: 10 },
      create: {
        userId: user.id,
        currentStreak: 7,
        longestStreak: 12,
        lastTrainedOn: today,
        dailyGoalPuzzles: 10,
      },
    });
    const dayRows = Array.from({ length: 14 }, (_, k) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - k);
      return {
        userId: user.id,
        day: d,
        puzzlesSolved: 4 + Math.floor(rnd() * 12),
        reviewsDone: Math.floor(rnd() * 6),
        drillsDone: Math.floor(rnd() * 3),
      };
    });
    await prisma.trainingDay.createMany({ data: dayRows, skipDuplicates: true });
    console.log(`  streak 7 (best 12) + ${dayRows.length} active days`);

    console.log(`\nFixture user ready: ${email}  (id ${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(`seed-perf-fixtures failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

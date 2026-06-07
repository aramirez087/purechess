import { PrismaClient, TimeControlCategory } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 } as const;

async function main() {
  const adminHash = await argon2.hash('Admin1234!', ARGON2_OPTIONS);
  const testHash = await argon2.hash('Test1234!', ARGON2_OPTIONS);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@purechess.local' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@purechess.local',
      passwordHash: adminHash,
      isAdmin: true,
    },
  });

  const alice = await prisma.user.upsert({
    where: { email: 'alice@purechess.local' },
    update: {},
    create: {
      username: 'alice',
      email: 'alice@purechess.local',
      passwordHash: testHash,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@purechess.local' },
    update: {},
    create: {
      username: 'bob',
      email: 'bob@purechess.local',
      passwordHash: testHash,
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: 'carol@purechess.local' },
    update: {},
    create: {
      username: 'carol',
      email: 'carol@purechess.local',
      passwordHash: testHash,
    },
  });

  const categories = [
    TimeControlCategory.bullet,
    TimeControlCategory.blitz,
    TimeControlCategory.rapid,
  ];

  for (const user of [admin, alice, bob, carol]) {
    for (const category of categories) {
      await prisma.rating.upsert({
        where: { userId_category: { userId: user.id, category } },
        update: {},
        create: { userId: user.id, category, rating: 1500 },
      });
    }
  }

  const game1 = await prisma.game.upsert({
    where: { id: 'seed-game-1' },
    update: {},
    create: {
      id: 'seed-game-1',
      whiteUserId: alice.id,
      blackUserId: bob.id,
      timeControlSeconds: 300,
      incrementSeconds: 0,
      category: TimeControlCategory.blitz,
      isRated: true,
      result: 'white_wins',
      resultReason: 'checkmate',
      status: 'completed',
      pgn: '1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0',
      finalFen: 'r1bqkb1r/pppp1Q1p/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4',
      whiteRatingBefore: 1500,
      blackRatingBefore: 1500,
      whiteRatingAfter: 1516,
      blackRatingAfter: 1484,
      startedAt: new Date('2026-06-01T10:00:00Z'),
      endedAt: new Date('2026-06-01T10:03:00Z'),
    },
  });

  const scholarsMateMoves = [
    { moveNumber: 1, ply: 1, userId: alice.id, san: 'e4', uci: 'e2e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', clock: 295000, time: 5000 },
    { moveNumber: 1, ply: 2, userId: bob.id, san: 'e5', uci: 'e7e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', clock: 293000, time: 7000 },
    { moveNumber: 2, ply: 3, userId: alice.id, san: 'Qh5', uci: 'd1h5', fen: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2', clock: 290000, time: 5000 },
    { moveNumber: 2, ply: 4, userId: bob.id, san: 'Nc6', uci: 'b8c6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3', clock: 285000, time: 8000 },
    { moveNumber: 3, ply: 5, userId: alice.id, san: 'Bc4', uci: 'f1c4', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', clock: 285000, time: 5000 },
    { moveNumber: 3, ply: 6, userId: bob.id, san: 'Nf6', uci: 'g8f6', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', clock: 280000, time: 5000 },
    { moveNumber: 4, ply: 7, userId: alice.id, san: 'Qxf7#', uci: 'h5f7', fen: 'r1bqkb1r/pppp1Q1p/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4', clock: 283000, time: 2000 },
  ];

  for (const m of scholarsMateMoves) {
    await prisma.move.upsert({
      where: { gameId_ply: { gameId: game1.id, ply: m.ply } },
      update: {},
      create: {
        gameId: game1.id,
        moveNumber: m.moveNumber,
        ply: m.ply,
        userId: m.userId,
        san: m.san,
        uci: m.uci,
        fenAfterMove: m.fen,
        clockAfterMoveMs: m.clock,
        moveTimeMs: m.time,
        createdAt: new Date('2026-06-01T10:00:00Z'),
      },
    });
  }

  await prisma.ratingHistory.createMany({
    skipDuplicates: true,
    data: [
      { userId: alice.id, category: TimeControlCategory.blitz, ratingBefore: 1500, ratingAfter: 1516, ratingDelta: 16, gameId: game1.id },
      { userId: bob.id, category: TimeControlCategory.blitz, ratingBefore: 1500, ratingAfter: 1484, ratingDelta: -16, gameId: game1.id },
    ],
  });

  const game2 = await prisma.game.upsert({
    where: { id: 'seed-game-2' },
    update: {},
    create: {
      id: 'seed-game-2',
      whiteUserId: bob.id,
      blackUserId: carol.id,
      timeControlSeconds: 600,
      incrementSeconds: 0,
      category: TimeControlCategory.rapid,
      isRated: false,
      result: 'draw',
      resultReason: 'draw_agreement',
      status: 'completed',
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1/2-1/2',
      finalFen: 'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 4 5',
      startedAt: new Date('2026-06-02T14:00:00Z'),
      endedAt: new Date('2026-06-02T14:12:00Z'),
    },
  });

  const ruyCastleMoves = [
    { moveNumber: 1, ply: 1, userId: bob.id, san: 'e4', uci: 'e2e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', clock: 598000, time: 2000 },
    { moveNumber: 1, ply: 2, userId: carol.id, san: 'e5', uci: 'e7e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', clock: 597000, time: 3000 },
    { moveNumber: 2, ply: 3, userId: bob.id, san: 'Nf3', uci: 'g1f3', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', clock: 595000, time: 3000 },
    { moveNumber: 2, ply: 4, userId: carol.id, san: 'Nc6', uci: 'b8c6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', clock: 594000, time: 3000 },
    { moveNumber: 3, ply: 5, userId: bob.id, san: 'Bb5', uci: 'f1b5', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', clock: 592000, time: 3000 },
    { moveNumber: 3, ply: 6, userId: carol.id, san: 'a6', uci: 'a7a6', fen: 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4', clock: 590000, time: 4000 },
    { moveNumber: 4, ply: 7, userId: bob.id, san: 'Ba4', uci: 'b5a4', fen: 'r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 4', clock: 589000, time: 3000 },
    { moveNumber: 4, ply: 8, userId: carol.id, san: 'Nf6', uci: 'g8f6', fen: 'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 5', clock: 587000, time: 3000 },
    { moveNumber: 5, ply: 9, userId: bob.id, san: 'O-O', uci: 'e1g1', fen: 'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 3 5', clock: 586000, time: 3000 },
    { moveNumber: 5, ply: 10, userId: carol.id, san: 'Be7', uci: 'f8e7', fen: 'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 6', clock: 584000, time: 3000 },
  ];

  for (const m of ruyCastleMoves) {
    await prisma.move.upsert({
      where: { gameId_ply: { gameId: game2.id, ply: m.ply } },
      update: {},
      create: {
        gameId: game2.id,
        moveNumber: m.moveNumber,
        ply: m.ply,
        userId: m.userId,
        san: m.san,
        uci: m.uci,
        fenAfterMove: m.fen,
        clockAfterMoveMs: m.clock,
        moveTimeMs: m.time,
        createdAt: new Date('2026-06-02T14:00:00Z'),
      },
    });
  }

  console.log('Seeded: admin, alice, bob, carol');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

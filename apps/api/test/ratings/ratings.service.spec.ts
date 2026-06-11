import { Test, TestingModule } from '@nestjs/testing';
import { RatingsService } from '../../src/ratings/ratings.service';
import { PrismaService } from '../../src/database/prisma.service';

const GAME_ID = 'game-1';
const WHITE_ID = 'user-white';
const BLACK_ID = 'user-black';

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: GAME_ID,
    whiteUserId: WHITE_ID,
    blackUserId: BLACK_ID,
    isVsComputer: false,
    isRated: true,
    status: 'completed',
    result: 'white_wins',
    category: 'rapid',
    whiteRatingBefore: null,
    whiteRatingAfter: null,
    blackRatingBefore: null,
    blackRatingAfter: null,
    ...overrides,
  };
}

function makeRatingRow(id: string, userId: string, rating = 1500) {
  return {
    id,
    userId,
    category: 'rapid',
    rating,
    ratingDeviation: 350,
    volatility: 0.06,
    gamesPlayed: 0,
  };
}

const txMock = {
  game: { updateMany: jest.fn(), update: jest.fn() },
  rating: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
  ratingHistory: { create: jest.fn() },
  $queryRaw: jest.fn().mockResolvedValue([]),
};

const mockPrisma = {
  game: { findUnique: jest.fn() },
  rating: { upsert: jest.fn() },
  $transaction: jest.fn(async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock)),
};

/** Wires upsert (pre-tx ensure) and the in-tx locked re-read to the same rows. */
function primeRatings(white: ReturnType<typeof makeRatingRow>, black: ReturnType<typeof makeRatingRow>) {
  mockPrisma.rating.upsert.mockResolvedValueOnce(white).mockResolvedValueOnce(black);
  txMock.rating.findUniqueOrThrow.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve(where.id === white.id ? white : black),
  );
}

describe('RatingsService', () => {
  let service: RatingsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    txMock.game.updateMany.mockResolvedValue({ count: 1 });
    txMock.$queryRaw.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(RatingsService);
  });

  it('processes a rated win: locked re-read, game snapshot, rating rows, history rows', async () => {
    mockPrisma.game.findUnique.mockResolvedValue(makeGame());
    primeRatings(makeRatingRow('r-w', WHITE_ID), makeRatingRow('r-b', BLACK_ID));

    await service.processGameResult(GAME_ID);

    // Idempotency gate runs first, on whiteRatingAfter IS NULL.
    expect(txMock.game.updateMany).toHaveBeenCalledWith({
      where: { id: GAME_ID, whiteRatingAfter: null },
      data: { whiteRatingAfter: 0 },
    });

    // Ratings are locked and re-read INSIDE the transaction (lost-update guard
    // for two different games sharing a player).
    expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(txMock.rating.findUniqueOrThrow).toHaveBeenCalledTimes(2);

    // Snapshots written from the locked reads.
    expect(txMock.game.update).toHaveBeenCalledTimes(1);
    const data = txMock.game.update.mock.calls[0][0].data;
    expect(data.whiteRatingBefore).toBe(1500);
    expect(data.whiteRatingAfter).toBeGreaterThan(1500);
    expect(data.blackRatingAfter).toBeLessThan(1500);
    // Symmetric for fresh equal players.
    expect(data.whiteRatingAfter - 1500).toBe(1500 - data.blackRatingAfter);

    // Both Rating rows updated with incremented games counter.
    expect(txMock.rating.update).toHaveBeenCalledTimes(2);
    expect(txMock.rating.update.mock.calls[0][0].data.gamesPlayed).toEqual({
      increment: 1,
    });

    // Two history rows with signed deltas linked to the game.
    expect(txMock.ratingHistory.create).toHaveBeenCalledTimes(2);
    const histories = txMock.ratingHistory.create.mock.calls.map((c) => c[0].data);
    const whiteHist = histories.find((h) => h.userId === WHITE_ID)!;
    const blackHist = histories.find((h) => h.userId === BLACK_ID)!;
    expect(whiteHist.ratingDelta).toBeGreaterThan(0);
    expect(blackHist.ratingDelta).toBeLessThan(0);
    expect(whiteHist.gameId).toBe(GAME_ID);
  });

  it('computes from the values read under the lock, not the pre-transaction read', async () => {
    mockPrisma.game.findUnique.mockResolvedValue(makeGame());
    // Pre-tx upsert sees a stale 1500; the locked in-tx read sees 1600
    // (another game's commit landed in between).
    mockPrisma.rating.upsert
      .mockResolvedValueOnce(makeRatingRow('r-w', WHITE_ID, 1500))
      .mockResolvedValueOnce(makeRatingRow('r-b', BLACK_ID, 1500));
    txMock.rating.findUniqueOrThrow.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === 'r-w'
          ? makeRatingRow('r-w', WHITE_ID, 1600)
          : makeRatingRow('r-b', BLACK_ID, 1500),
      ),
    );

    await service.processGameResult(GAME_ID);

    const data = txMock.game.update.mock.calls[0][0].data;
    expect(data.whiteRatingBefore).toBe(1600);
  });

  it.each([
    ['unrated', makeGame({ isRated: false })],
    ['vs computer', makeGame({ isVsComputer: true })],
    ['not completed', makeGame({ status: 'active' })],
    ['no result', makeGame({ result: null })],
    ['anonymous side', makeGame({ blackUserId: null })],
    ['already processed', makeGame({ whiteRatingAfter: 1512 })],
  ])('skips %s games', async (_label, game) => {
    mockPrisma.game.findUnique.mockResolvedValue(game);
    await service.processGameResult(GAME_ID);
    expect(mockPrisma.rating.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('a draw between unequal players moves both toward each other', async () => {
    mockPrisma.game.findUnique.mockResolvedValue(makeGame({ result: 'draw' }));
    primeRatings(makeRatingRow('r-w', WHITE_ID, 1700), makeRatingRow('r-b', BLACK_ID, 1300));

    await service.processGameResult(GAME_ID);

    const data = txMock.game.update.mock.calls[0][0].data;
    expect(data.whiteRatingAfter).toBeLessThan(1700);
    expect(data.blackRatingAfter).toBeGreaterThan(1300);
  });

  it('loses the idempotency race quietly', async () => {
    mockPrisma.game.findUnique.mockResolvedValue(makeGame());
    primeRatings(makeRatingRow('r-w', WHITE_ID), makeRatingRow('r-b', BLACK_ID));
    txMock.game.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processGameResult(GAME_ID)).resolves.toBeUndefined();
    expect(txMock.game.update).not.toHaveBeenCalled();
    expect(txMock.ratingHistory.create).not.toHaveBeenCalled();
  });
});

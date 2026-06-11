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
  game: { updateMany: jest.fn() },
  rating: { update: jest.fn() },
  ratingHistory: { create: jest.fn() },
};

const mockPrisma = {
  game: { findUnique: jest.fn() },
  rating: { upsert: jest.fn() },
  $transaction: jest.fn(async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock)),
};

describe('RatingsService', () => {
  let service: RatingsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    txMock.game.updateMany.mockResolvedValue({ count: 1 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(RatingsService);
  });

  it('processes a rated win: game snapshot, rating rows, history rows', async () => {
    mockPrisma.game.findUnique.mockResolvedValue(makeGame());
    mockPrisma.rating.upsert
      .mockResolvedValueOnce(makeRatingRow('r-w', WHITE_ID))
      .mockResolvedValueOnce(makeRatingRow('r-b', BLACK_ID));

    await service.processGameResult(GAME_ID);

    // Game gets before/after snapshots, gated on whiteRatingAfter IS NULL.
    expect(txMock.game.updateMany).toHaveBeenCalledTimes(1);
    const gameUpdate = txMock.game.updateMany.mock.calls[0][0];
    expect(gameUpdate.where).toEqual({ id: GAME_ID, whiteRatingAfter: null });
    expect(gameUpdate.data.whiteRatingBefore).toBe(1500);
    expect(gameUpdate.data.whiteRatingAfter).toBeGreaterThan(1500);
    expect(gameUpdate.data.blackRatingAfter).toBeLessThan(1500);
    // Symmetric for fresh equal players.
    expect(gameUpdate.data.whiteRatingAfter - 1500).toBe(
      1500 - gameUpdate.data.blackRatingAfter,
    );

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
    mockPrisma.rating.upsert
      .mockResolvedValueOnce(makeRatingRow('r-w', WHITE_ID, 1700))
      .mockResolvedValueOnce(makeRatingRow('r-b', BLACK_ID, 1300));

    await service.processGameResult(GAME_ID);

    const data = txMock.game.updateMany.mock.calls[0][0].data;
    expect(data.whiteRatingAfter).toBeLessThan(1700);
    expect(data.blackRatingAfter).toBeGreaterThan(1300);
  });

  it('loses the idempotency race quietly', async () => {
    mockPrisma.game.findUnique.mockResolvedValue(makeGame());
    mockPrisma.rating.upsert
      .mockResolvedValueOnce(makeRatingRow('r-w', WHITE_ID))
      .mockResolvedValueOnce(makeRatingRow('r-b', BLACK_ID));
    txMock.game.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processGameResult(GAME_ID)).resolves.toBeUndefined();
    expect(txMock.ratingHistory.create).not.toHaveBeenCalled();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { PuzzleRatingService } from '../../src/puzzles/puzzle-rating.service';
import { PrismaService } from '../../src/database/prisma.service';
import { updateRating, type GlickoRating } from '../../src/ratings/glicko2';

const mockPrisma = {
  puzzleRating: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('PuzzleRatingService', () => {
  let service: PuzzleRatingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PuzzleRatingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<PuzzleRatingService>(PuzzleRatingService);
  });

  describe('applyResult', () => {
    it('defaults a brand-new user to 1500/350/0.06 then moves them', async () => {
      mockPrisma.puzzleRating.findUnique.mockResolvedValue(null);
      mockPrisma.puzzleRating.upsert.mockResolvedValue({});

      const result = await service.applyResult('u1', 1600, 80, true);

      // A solved puzzle harder than the (defaulted 1500) solver → rating up.
      expect(result.rating).toBeGreaterThan(1500);
      // Solving shrinks deviation from the 350 default.
      expect(result.deviation).toBeLessThan(350);

      // Upsert writes the unrounded Glicko values; create-branch carries userId.
      const call = mockPrisma.puzzleRating.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId: 'u1' });
      expect(call.create.userId).toBe('u1');
      expect(call.create.rating).toBeCloseTo(result.rating, 9);
      expect(call.update.rating).toBeCloseTo(result.rating, 9);
    });

    it('a solved puzzle raises the rating, a failed one lowers it (same puzzle)', async () => {
      mockPrisma.puzzleRating.findUnique.mockResolvedValue({
        userId: 'u1',
        rating: 1500,
        deviation: 200,
        volatility: 0.06,
      });
      mockPrisma.puzzleRating.upsert.mockResolvedValue({});

      const solved = await service.applyResult('u1', 1500, 80, true);
      const failed = await service.applyResult('u1', 1500, 80, false);

      expect(solved.rating).toBeGreaterThan(1500);
      expect(failed.rating).toBeLessThan(1500);
    });

    it('reuses the shared Glicko engine — result equals updateRating directly', async () => {
      const player: GlickoRating = { rating: 1500, ratingDeviation: 200, volatility: 0.06 };
      mockPrisma.puzzleRating.findUnique.mockResolvedValue({
        userId: 'u1',
        rating: player.rating,
        deviation: player.ratingDeviation,
        volatility: player.volatility,
      });
      mockPrisma.puzzleRating.upsert.mockResolvedValue({});

      const result = await service.applyResult('u1', 1700, 100, false);
      const direct = updateRating(player, [
        {
          opponent: { rating: 1700, ratingDeviation: 100, volatility: 0.06 },
          score: 0,
        },
      ]);

      expect(result.rating).toBeCloseTo(direct.rating, 9);
      expect(result.deviation).toBeCloseTo(direct.ratingDeviation, 9);
      expect(result.volatility).toBeCloseTo(direct.volatility, 9);
    });

    it('clamps a zero-deviation puzzle opponent to a sane floor', async () => {
      mockPrisma.puzzleRating.findUnique.mockResolvedValue(null);
      mockPrisma.puzzleRating.upsert.mockResolvedValue({});

      // ratingDeviation = 0 must not collapse the variance term (no NaN/Infinity).
      const result = await service.applyResult('u1', 1500, 0, true);
      expect(Number.isFinite(result.rating)).toBe(true);
      expect(Number.isFinite(result.deviation)).toBe(true);
      expect(result.rating).toBeGreaterThan(1500);
    });
  });

  describe('get', () => {
    it('returns the persisted snapshot with an ISO updatedAt', async () => {
      const updatedAt = new Date('2026-06-13T10:00:00.000Z');
      mockPrisma.puzzleRating.findUnique.mockResolvedValue({
        userId: 'u1',
        rating: 1623.4,
        deviation: 110.2,
        volatility: 0.059,
        updatedAt,
      });

      await expect(service.get('u1')).resolves.toEqual({
        rating: 1623.4,
        deviation: 110.2,
        volatility: 0.059,
        updatedAt: '2026-06-13T10:00:00.000Z',
      });
    });

    it('returns 1500/350/0.06 defaults for an unrated user', async () => {
      mockPrisma.puzzleRating.findUnique.mockResolvedValue(null);
      await expect(service.get('nobody')).resolves.toEqual({
        rating: 1500,
        deviation: 350,
        volatility: 0.06,
      });
    });
  });
});

describe('game-rating non-regression (shared Glicko engine)', () => {
  // PIN: the puzzle rating service reuses `updateRating` from
  // apps/api/src/ratings/glicko2.ts verbatim. This guards that the shared
  // engine still reproduces Glickman's worked example exactly — i.e. game
  // ratings are provably unchanged by S03's reuse.
  it('reproduces the Glicko-2 paper worked example unchanged', () => {
    const player: GlickoRating = { rating: 1500, ratingDeviation: 200, volatility: 0.06 };
    const result = updateRating(player, [
      { opponent: { rating: 1400, ratingDeviation: 30, volatility: 0.06 }, score: 1 },
      { opponent: { rating: 1550, ratingDeviation: 100, volatility: 0.06 }, score: 0 },
      { opponent: { rating: 1700, ratingDeviation: 300, volatility: 0.06 }, score: 0 },
    ]);
    expect(result.rating).toBeCloseTo(1464.06, 1);
    expect(result.ratingDeviation).toBeCloseTo(151.52, 1);
    expect(result.volatility).toBeCloseTo(0.05999, 4);
  });
});

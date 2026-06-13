import { Test, TestingModule } from '@nestjs/testing';
import type { PuzzleThemeStatDto } from '@purechess/shared';
import {
  PuzzleHistoryService,
  bucketDailyClose,
  selectWeakestTheme,
} from '../../src/puzzles/puzzle-history.service';
import { PuzzleRatingService } from '../../src/puzzles/puzzle-rating.service';
import { PuzzleServingService } from '../../src/puzzles/puzzle-serving.service';
import { PrismaService } from '../../src/database/prisma.service';

const mockPrisma = {
  puzzleAttempt: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockRating = { get: jest.fn() };
const mockServing = { getStats: jest.fn() };

function attempt(rating: number, at: string) {
  return { ratingAfterUser: rating, createdAt: new Date(at) };
}

describe('PuzzleHistoryService', () => {
  let service: PuzzleHistoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PuzzleHistoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PuzzleRatingService, useValue: mockRating },
        { provide: PuzzleServingService, useValue: mockServing },
      ],
    }).compile();
    service = module.get(PuzzleHistoryService);
  });

  describe('ratingHistory bucketing + cap', () => {
    it('caps the DB read at 200 most-recent rated attempts (heavy user)', async () => {
      // Heavy user: every attempt is its own UTC day so no daily-collapse — the
      // ONLY thing that can bound the series is the read cap. Prove the cap is
      // passed to the query and the returned series never exceeds it.
      const capped = Array.from({ length: 200 }, (_, i) =>
        // distinct days, oldest-first as the service re-orders
        attempt(1400 + i, `2025-01-01T00:00:00.000Z`),
      ).map((a, i) => ({
        ratingAfterUser: a.ratingAfterUser,
        // distinct calendar days so daily-close keeps all 200
        createdAt: new Date(Date.UTC(2024, 0, 1 + i)),
      }));
      // findMany is what enforces `take`; return exactly the cap.
      mockPrisma.puzzleAttempt.findMany.mockResolvedValue([...capped].reverse());

      const out = await service.ratingHistory('u1');

      // The query asked for at most 200 rows, newest-first.
      expect(mockPrisma.puzzleAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', ratingAfterUser: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      );
      // Series is bounded by the cap even with 200 distinct days.
      expect(out.length).toBeLessThanOrEqual(200);
      expect(out).toHaveLength(200);
    });

    it('collapses same-day attempts to one daily-close point (heavy day)', async () => {
      // 300 attempts in a SINGLE day → exactly one point (the day's close).
      const sameDay = Array.from({ length: 300 }, (_, i) => ({
        ratingAfterUser: 1500 + i,
        createdAt: new Date(Date.UTC(2025, 2, 4, 0, i % 60, 0)),
      }));
      mockPrisma.puzzleAttempt.findMany.mockResolvedValue([...sameDay].reverse());

      const out = await service.ratingHistory('u1');
      expect(out).toHaveLength(1);
      expect(out[0].at.slice(0, 10)).toBe('2025-03-04');
    });

    it('returns [] when the user has no rated attempts', async () => {
      mockPrisma.puzzleAttempt.findMany.mockResolvedValue([]);
      expect(await service.ratingHistory('u1')).toEqual([]);
    });
  });

  describe('summary', () => {
    it('reports rating, attempted/solved/accuracy, and the weakest theme', async () => {
      mockRating.get.mockResolvedValue({ rating: 1623.7, deviation: 80, volatility: 0.06 });
      mockServing.getStats.mockResolvedValue([
        { slug: 'pin', attempts: 10, solved: 3, accuracy: 0.3 },
        { slug: 'fork', attempts: 20, solved: 18, accuracy: 0.9 },
      ] satisfies PuzzleThemeStatDto[]);
      // count() called twice: total then solved=true.
      mockPrisma.puzzleAttempt.count
        .mockResolvedValueOnce(50) // attempted
        .mockResolvedValueOnce(31); // solved

      const out = await service.summary('u1');
      expect(out.puzzleRating).toBe(1624); // rounded
      expect(out.attempted).toBe(50);
      expect(out.solved).toBe(31);
      expect(out.accuracy).toBeCloseTo(31 / 50, 6);
      expect(out.weakestTheme?.slug).toBe('pin');
    });

    it('leaves accuracy undefined and weakestTheme null with no attempts', async () => {
      mockRating.get.mockResolvedValue({ rating: 1500 });
      mockServing.getStats.mockResolvedValue([]);
      mockPrisma.puzzleAttempt.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const out = await service.summary('u1');
      expect(out.attempted).toBe(0);
      expect(out.accuracy).toBeUndefined();
      expect(out.weakestTheme).toBeNull();
    });
  });
});

describe('bucketDailyClose (pure)', () => {
  it('keeps the LAST rating of each UTC day, oldest-first', () => {
    const out = bucketDailyClose([
      { rating: 1500, at: '2025-01-01T08:00:00.000Z' },
      { rating: 1510, at: '2025-01-01T20:00:00.000Z' }, // same day → wins
      { rating: 1490, at: '2025-01-02T09:00:00.000Z' },
    ]);
    expect(out).toEqual([
      { rating: 1510, at: '2025-01-01T20:00:00.000Z' },
      { rating: 1490, at: '2025-01-02T09:00:00.000Z' },
    ]);
  });

  it('caps the point count at the number of distinct days', () => {
    // 1000 points across 7 days → at most 7 points.
    const points = Array.from({ length: 1000 }, (_, i) => ({
      rating: 1500 + i,
      at: new Date(Date.UTC(2025, 0, 1 + (i % 7), i % 24)).toISOString(),
    }));
    const out = bucketDailyClose(points);
    expect(out.length).toBeLessThanOrEqual(7);
  });

  it('rounds fractional ratings', () => {
    const out = bucketDailyClose([{ rating: 1500.6, at: '2025-01-01T00:00:00.000Z' }]);
    expect(out[0].rating).toBe(1501);
  });
});

describe('selectWeakestTheme (pure)', () => {
  const s = (over: Partial<PuzzleThemeStatDto> & { slug: string }): PuzzleThemeStatDto => ({
    attempts: 10,
    solved: 5,
    accuracy: 0.5,
    ...over,
  });

  it('picks the lowest-accuracy theme with at least 5 attempts', () => {
    const out = selectWeakestTheme([
      s({ slug: 'fork', accuracy: 0.8, attempts: 20 }),
      s({ slug: 'pin', accuracy: 0.3, attempts: 12 }),
    ]);
    expect(out?.slug).toBe('pin');
  });

  it('ignores themes below the min-attempts floor', () => {
    const out = selectWeakestTheme([
      s({ slug: 'rare', accuracy: 0.0, attempts: 2 }), // too few → ignored
      s({ slug: 'fork', accuracy: 0.6, attempts: 30 }),
    ]);
    expect(out?.slug).toBe('fork');
  });

  it('returns null when nothing qualifies', () => {
    expect(selectWeakestTheme([s({ slug: 'rare', attempts: 1 })])).toBeNull();
    expect(selectWeakestTheme([])).toBeNull();
  });
});

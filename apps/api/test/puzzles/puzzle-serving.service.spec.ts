import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PuzzleServingService } from '../../src/puzzles/puzzle-serving.service';
import { PuzzleRatingService } from '../../src/puzzles/puzzle-rating.service';
import { PrismaService } from '../../src/database/prisma.service';

const mockPrisma = {
  $queryRaw: jest.fn(),
  puzzle: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  puzzleAttempt: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  puzzleRating: {
    findUnique: jest.fn(),
  },
};

const mockRatingService = {
  get: jest.fn(),
  applyResult: jest.fn(),
};

function puzzleRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'P1',
    fen: 'fen',
    moves: ['e2e4'],
    rating: 1500,
    ratingDeviation: 80,
    popularity: 90,
    plays: 100,
    themes: ['fork'],
    openingTags: [],
    ...over,
  };
}

/** Last `$queryRaw` call's bound SQL + values (Prisma.Sql shape). */
function lastQuery(): { sql: string; values: unknown[] } {
  const calls = mockPrisma.$queryRaw.mock.calls;
  const arg = calls[calls.length - 1][0] as { sql: string; values: unknown[] };
  return { sql: arg.sql, values: arg.values };
}

describe('PuzzleServingService', () => {
  let service: PuzzleServingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PuzzleServingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PuzzleRatingService, useValue: mockRatingService },
      ],
    }).compile();
    service = module.get<PuzzleServingService>(PuzzleServingService);
  });

  describe('getNext — target rating resolution', () => {
    it('uses the explicit rating arg as the window centre', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([puzzleRow()]);

      await service.getNext('u1', { rating: 1800 });

      const { sql, values } = lastQuery();
      expect(sql).toContain('p.rating BETWEEN');
      // ±150 around 1800.
      expect(values).toEqual(expect.arrayContaining([1650, 1950, 'u1']));
    });

    it("falls back to the user's puzzle rating when no rating arg", async () => {
      mockPrisma.puzzleRating.findUnique.mockResolvedValue({ rating: 1200 });
      mockPrisma.$queryRaw.mockResolvedValue([puzzleRow()]);

      await service.getNext('u1', {});

      const { values } = lastQuery();
      expect(values).toEqual(expect.arrayContaining([1050, 1350]));
    });

    it('defaults to 1500 for an unrated user', async () => {
      mockPrisma.puzzleRating.findUnique.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([puzzleRow()]);

      await service.getNext('u1', {});

      const { values } = lastQuery();
      expect(values).toEqual(expect.arrayContaining([1350, 1650]));
    });
  });

  describe('getNext — exclusion + theme filter', () => {
    it('excludes already-attempted puzzle ids via a NOT EXISTS subquery on PuzzleAttempt', async () => {
      mockPrisma.puzzleRating.findUnique.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([puzzleRow()]);

      await service.getNext('u1', {});

      const { sql, values } = lastQuery();
      expect(sql).toContain('NOT EXISTS');
      expect(sql).toContain('"PuzzleAttempt"');
      expect(sql).toContain('a."userId"');
      // userId is bound, never interpolated.
      expect(values).toContain('u1');
    });

    it('applies a themes @> ARRAY containment when a theme is given', async () => {
      mockPrisma.puzzleRating.findUnique.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([puzzleRow({ themes: ['pin'] })]);

      await service.getNext('u1', { theme: 'pin' });

      const { sql, values } = lastQuery();
      expect(sql).toContain('p.themes @> ARRAY[');
      expect(values).toContain('pin');
    });

    it('omits the theme containment when no theme is given', async () => {
      mockPrisma.puzzleRating.findUnique.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([puzzleRow()]);

      await service.getNext('u1', {});

      const { sql } = lastQuery();
      expect(sql).not.toContain('@>');
    });

    it('picks randomly and takes one', async () => {
      mockPrisma.puzzleRating.findUnique.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([puzzleRow()]);

      const dto = await service.getNext('u1', {});

      const { sql } = lastQuery();
      expect(sql).toContain('ORDER BY random()');
      expect(sql).toContain('LIMIT 1');
      expect(dto.id).toBe('P1');
    });
  });

  describe('getNext — fallback ladder', () => {
    it('widens to ±300 then ±600 before dropping the unseen filter', async () => {
      mockPrisma.puzzleRating.findUnique.mockResolvedValue({ rating: 1500 });
      // Tiers 0 (±150), 1 (±300), 2 (±600) all empty; final (drop) returns one.
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // ±150
        .mockResolvedValueOnce([]) // ±300
        .mockResolvedValueOnce([]) // ±600
        .mockResolvedValueOnce([puzzleRow()]); // drop unseen + window

      const dto = await service.getNext('u1', {});
      expect(dto.id).toBe('P1');

      const calls = mockPrisma.$queryRaw.mock.calls.map(
        (c) => (c[0] as { values: unknown[] }).values,
      );
      // The four widening tiers, in order.
      expect(calls[0]).toEqual(expect.arrayContaining([1350, 1650]));
      expect(calls[1]).toEqual(expect.arrayContaining([1200, 1800]));
      expect(calls[2]).toEqual(expect.arrayContaining([900, 2100]));
      // Final tier: no rating window bound (no min/max numbers present), and no
      // NOT EXISTS exclusion in the SQL.
      const finalSql = (mockPrisma.$queryRaw.mock.calls[3][0] as { sql: string }).sql;
      expect(finalSql).not.toContain('BETWEEN');
      expect(finalSql).not.toContain('NOT EXISTS');
    });

    it('the final tier keeps the theme filter even after dropping unseen', async () => {
      mockPrisma.puzzleRating.findUnique.mockResolvedValue({ rating: 1500 });
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([puzzleRow({ themes: ['skewer'] })]);

      await service.getNext('u1', { theme: 'skewer' });

      const finalSql = (mockPrisma.$queryRaw.mock.calls[3][0] as { sql: string }).sql;
      const finalValues = (mockPrisma.$queryRaw.mock.calls[3][0] as { values: unknown[] }).values;
      expect(finalSql).toContain('@>');
      expect(finalValues).toContain('skewer');
    });

    it('throws NotFound when even the dropped-filter tier is empty', async () => {
      mockPrisma.puzzleRating.findUnique.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await expect(service.getNext('u1', {})).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('recordAttempt', () => {
    it('writes a row, drives the rating, bumps plays, and returns the delta', async () => {
      mockPrisma.puzzle.findUnique.mockResolvedValue({
        id: 'P1',
        rating: 1600,
        ratingDeviation: 80,
      });
      mockRatingService.get.mockResolvedValue({ rating: 1500 });
      mockRatingService.applyResult.mockResolvedValue({
        rating: 1512.6,
        deviation: 180,
        volatility: 0.06,
      });
      mockPrisma.puzzleAttempt.create.mockResolvedValue({});
      mockPrisma.puzzle.update.mockResolvedValue({});

      const result = await service.recordAttempt('u1', 'P1', {
        solved: true,
        msToSolve: 4200,
        source: 'theme',
      });

      // Rating engine called with the puzzle as opponent + the solved score.
      expect(mockRatingService.applyResult).toHaveBeenCalledWith('u1', 1600, 80, true);

      // Attempt row captures before/after (rounded) + the outcome.
      const created = mockPrisma.puzzleAttempt.create.mock.calls[0][0].data;
      expect(created).toMatchObject({
        userId: 'u1',
        puzzleId: 'P1',
        solved: true,
        msToSolve: 4200,
        ratingBeforeUser: 1500,
        ratingAfterUser: 1513, // round(1512.6)
        source: 'theme',
      });

      // Puzzle.plays incremented.
      expect(mockPrisma.puzzle.update).toHaveBeenCalledWith({
        where: { id: 'P1' },
        data: { plays: { increment: 1 } },
      });

      // Returned DTO carries the real delta.
      expect(result).toEqual({
        puzzleId: 'P1',
        solved: true,
        ratingBefore: 1500,
        ratingAfter: 1513,
        ratingDelta: 13,
      });
    });

    it('defaults source to "theme" and msToSolve to null when omitted', async () => {
      mockPrisma.puzzle.findUnique.mockResolvedValue({
        id: 'P1',
        rating: 1400,
        ratingDeviation: 80,
      });
      mockRatingService.get.mockResolvedValue({ rating: 1500 });
      mockRatingService.applyResult.mockResolvedValue({
        rating: 1488,
        deviation: 180,
        volatility: 0.06,
      });
      mockPrisma.puzzleAttempt.create.mockResolvedValue({});
      mockPrisma.puzzle.update.mockResolvedValue({});

      const result = await service.recordAttempt('u1', 'P1', { solved: false });

      const created = mockPrisma.puzzleAttempt.create.mock.calls[0][0].data;
      expect(created.source).toBe('theme');
      expect(created.msToSolve).toBeNull();
      expect(result.ratingDelta).toBe(-12); // 1488 - 1500
    });

    it('throws NotFound for an unknown puzzle and never touches the rating', async () => {
      mockPrisma.puzzle.findUnique.mockResolvedValue(null);

      await expect(
        service.recordAttempt('u1', 'nope', { solved: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockRatingService.applyResult).not.toHaveBeenCalled();
      expect(mockPrisma.puzzleAttempt.create).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('computes per-theme accuracy (3/5 = 60%) and counts every theme an attempt lists', async () => {
      // 5 attempts on the 'fork' theme: 3 solved → 60%.
      const mk = (solved: boolean, themes: string[], ms: number | null, day: string) => ({
        solved,
        msToSolve: ms,
        createdAt: new Date(`2026-06-${day}T00:00:00.000Z`),
        puzzle: { themes },
      });
      mockPrisma.puzzleAttempt.findMany.mockResolvedValue([
        mk(true, ['fork', 'pin'], 1000, '05'),
        mk(true, ['fork'], 2000, '04'),
        mk(true, ['fork'], null, '03'),
        mk(false, ['fork'], 3000, '02'),
        mk(false, ['fork'], 3000, '01'),
      ]);

      const stats = await service.getStats('u1');

      const fork = stats.find((s) => s.slug === 'fork')!;
      expect(fork.attempts).toBe(5);
      expect(fork.solved).toBe(3);
      expect(fork.accuracy).toBeCloseTo(0.6, 9);
      // avg over the 4 solved-or-not attempts that recorded ms: (1000+2000+3000+3000)/4.
      expect(fork.avgMsToSolve).toBe(2250);
      expect(fork.lastAttemptedAt).toBe('2026-06-05T00:00:00.000Z');

      // 'pin' only appeared on the one solved attempt → 100%.
      const pin = stats.find((s) => s.slug === 'pin')!;
      expect(pin.attempts).toBe(1);
      expect(pin.solved).toBe(1);
      expect(pin.accuracy).toBe(1);
    });

    it('sorts weakest-first (accuracy ASC)', async () => {
      const mk = (solved: boolean, theme: string) => ({
        solved,
        msToSolve: null,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        puzzle: { themes: [theme] },
      });
      mockPrisma.puzzleAttempt.findMany.mockResolvedValue([
        // strong: 2/2 = 100%
        mk(true, 'strong'),
        mk(true, 'strong'),
        // weak: 0/2 = 0%
        mk(false, 'weak'),
        mk(false, 'weak'),
        // mid: 1/2 = 50%
        mk(true, 'mid'),
        mk(false, 'mid'),
      ]);

      const stats = await service.getStats('u1');
      expect(stats.map((s) => s.slug)).toEqual(['weak', 'mid', 'strong']);
    });

    it('returns an empty array when the user has no attempts', async () => {
      mockPrisma.puzzleAttempt.findMany.mockResolvedValue([]);
      await expect(service.getStats('u1')).resolves.toEqual([]);
    });

    it('caps the recent-attempt fetch at 1000, newest first', async () => {
      mockPrisma.puzzleAttempt.findMany.mockResolvedValue([]);
      await service.getStats('u1');
      expect(mockPrisma.puzzleAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        }),
      );
    });
  });
});

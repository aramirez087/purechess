import { Test, TestingModule } from '@nestjs/testing';
import {
  GRADUATION_INTERVAL_DAYS,
  PuzzleReviewService,
} from '../../src/puzzles/puzzle-review.service';
import { PrismaService } from '../../src/database/prisma.service';

const mockPrisma = {
  puzzleReview: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

function puzzle(id = 'P1') {
  return {
    id,
    fen: 'fen',
    moves: ['e2e4'],
    rating: 1500,
    ratingDeviation: 80,
    popularity: 90,
    plays: 100,
    themes: ['fork'],
    openingTags: [],
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('PuzzleReviewService', () => {
  let service: PuzzleReviewService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PuzzleReviewService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<PuzzleReviewService>(PuzzleReviewService);
  });

  describe('enqueueOnFail', () => {
    it('upserts a fresh card due ~tomorrow for a first-time failure', async () => {
      mockPrisma.puzzleReview.findUnique.mockResolvedValue(null);
      mockPrisma.puzzleReview.upsert.mockResolvedValue({});

      const before = Date.now();
      await service.enqueueOnFail('u1', 'P1');

      expect(mockPrisma.puzzleReview.upsert).toHaveBeenCalledTimes(1);
      const arg = mockPrisma.puzzleReview.upsert.mock.calls[0][0];
      expect(arg.where).toEqual({ userId_puzzleId: { userId: 'u1', puzzleId: 'P1' } });

      // Fresh lapse: interval 1d, reps 0, lapses 1, ease penalised from 2.5 → 2.3.
      expect(arg.create).toMatchObject({
        userId: 'u1',
        puzzleId: 'P1',
        intervalDays: 1,
        reps: 0,
        lapses: 1,
        easeFactor: 2.3,
      });
      // Due roughly one day out.
      const dueAt = (arg.create.dueAt as Date).getTime();
      expect(dueAt).toBeGreaterThanOrEqual(before + MS_PER_DAY - 1000);
      expect(dueAt).toBeLessThanOrEqual(Date.now() + MS_PER_DAY + 1000);
    });

    it('re-lapses an already-queued card (reps reset, lapses increment, ease drops)', async () => {
      mockPrisma.puzzleReview.findUnique.mockResolvedValue({
        intervalDays: 15,
        easeFactor: 2.5,
        reps: 3,
        lapses: 0,
      });
      mockPrisma.puzzleReview.upsert.mockResolvedValue({});

      await service.enqueueOnFail('u1', 'P1');

      const arg = mockPrisma.puzzleReview.upsert.mock.calls[0][0];
      expect(arg.update).toMatchObject({
        intervalDays: 1,
        reps: 0,
        lapses: 1,
        easeFactor: 2.3,
      });
    });
  });

  describe('getDue', () => {
    it('queries only due rows, oldest-first, and maps to PuzzleDto', async () => {
      mockPrisma.puzzleReview.findMany.mockResolvedValue([
        { puzzle: puzzle('A') },
        { puzzle: puzzle('B') },
      ]);

      const out = await service.getDue('u1', 5);

      const arg = mockPrisma.puzzleReview.findMany.mock.calls[0][0];
      expect(arg.where.userId).toBe('u1');
      expect(arg.where.dueAt.lte).toBeInstanceOf(Date);
      expect(arg.orderBy).toEqual({ dueAt: 'asc' }); // oldest first
      expect(arg.take).toBe(5);

      // Mapped to the public DTO shape (id/fen/moves/rating/themes...).
      expect(out).toHaveLength(2);
      expect(out[0]).toMatchObject({ id: 'A', fen: 'fen', themes: ['fork'] });
      expect(out[1].id).toBe('B');
    });

    it('defaults the limit to 20', async () => {
      mockPrisma.puzzleReview.findMany.mockResolvedValue([]);
      await service.getDue('u1');
      expect(mockPrisma.puzzleReview.findMany.mock.calls[0][0].take).toBe(20);
    });
  });

  describe('dueCount', () => {
    it('counts rows due now for the user', async () => {
      mockPrisma.puzzleReview.count.mockResolvedValue(7);
      const n = await service.dueCount('u1');
      expect(n).toBe(7);
      const arg = mockPrisma.puzzleReview.count.mock.calls[0][0];
      expect(arg.where.userId).toBe('u1');
      expect(arg.where.dueAt.lte).toBeInstanceOf(Date);
    });
  });

  describe('grade', () => {
    it('reschedules a solved card forward and returns the next due date', async () => {
      // Card on its 2nd rep (interval 6); a `good` solve → 6*2.5=15d.
      mockPrisma.puzzleReview.findUnique.mockResolvedValue({
        intervalDays: 6,
        easeFactor: 2.5,
        reps: 2,
        lapses: 0,
      });
      mockPrisma.puzzleReview.update.mockResolvedValue({});

      const res = await service.grade('u1', 'P1', true, 20000); // slow solve → 'good'

      expect(res.graduated).toBe(false);
      expect(res.intervalDays).toBe(15);
      expect(res.nextDueAt).not.toBeNull();
      const arg = mockPrisma.puzzleReview.update.mock.calls[0][0];
      expect(arg.where).toEqual({ userId_puzzleId: { userId: 'u1', puzzleId: 'P1' } });
      expect(arg.data).toMatchObject({ intervalDays: 15, reps: 3, lapses: 0 });
      expect(mockPrisma.puzzleReview.delete).not.toHaveBeenCalled();
    });

    it('a failed grade lapses the card back to ~1 day (not graduated)', async () => {
      mockPrisma.puzzleReview.findUnique.mockResolvedValue({
        intervalDays: 15,
        easeFactor: 2.5,
        reps: 3,
        lapses: 0,
      });
      mockPrisma.puzzleReview.update.mockResolvedValue({});

      const res = await service.grade('u1', 'P1', false);

      expect(res.graduated).toBe(false);
      expect(res.intervalDays).toBe(1);
      const arg = mockPrisma.puzzleReview.update.mock.calls[0][0];
      expect(arg.data).toMatchObject({ intervalDays: 1, reps: 0, lapses: 1 });
    });

    it('graduates (deletes) a learned card once the interval crosses the threshold', async () => {
      // Big interval × ease pushes well past GRADUATION_INTERVAL_DAYS (30).
      mockPrisma.puzzleReview.findUnique.mockResolvedValue({
        intervalDays: 20,
        easeFactor: 2.5,
        reps: 4,
        lapses: 0,
      });
      mockPrisma.puzzleReview.delete.mockResolvedValue({});

      const res = await service.grade('u1', 'P1', true, 20000); // 20*2.5 = 50 > 30

      expect(res.graduated).toBe(true);
      expect(res.nextDueAt).toBeNull();
      expect(res.intervalDays).toBeGreaterThan(GRADUATION_INTERVAL_DAYS);
      expect(mockPrisma.puzzleReview.delete).toHaveBeenCalledWith({
        where: { userId_puzzleId: { userId: 'u1', puzzleId: 'P1' } },
      });
      expect(mockPrisma.puzzleReview.update).not.toHaveBeenCalled();
    });

    it('grades a fast solve as easy (bigger interval than good)', async () => {
      mockPrisma.puzzleReview.findUnique.mockResolvedValue({
        intervalDays: 6,
        easeFactor: 2.5,
        reps: 2,
        lapses: 0,
      });
      mockPrisma.puzzleReview.update.mockResolvedValue({});

      const easy = await service.grade('u1', 'P1', true, 3000); // < 8s → 'easy'
      // easy ease 2.65; base round(6*2.65)=16; *1.3 = 21 (> good's 15)
      expect(easy.intervalDays).toBe(21);
    });

    it('is a no-op (graduated, no write) when the puzzle is not queued', async () => {
      mockPrisma.puzzleReview.findUnique.mockResolvedValue(null);

      const res = await service.grade('u1', 'P1', true);

      expect(res).toEqual({ puzzleId: 'P1', graduated: true, nextDueAt: null, intervalDays: 0 });
      expect(mockPrisma.puzzleReview.update).not.toHaveBeenCalled();
      expect(mockPrisma.puzzleReview.delete).not.toHaveBeenCalled();
    });
  });

  describe('getDuePayload', () => {
    it('bundles the due queue + count, and the next-due date when nothing is due', async () => {
      mockPrisma.puzzleReview.findMany.mockResolvedValue([]);
      mockPrisma.puzzleReview.count.mockResolvedValue(0);
      const next = new Date(Date.now() + 2 * MS_PER_DAY);
      mockPrisma.puzzleReview.findFirst.mockResolvedValue({ dueAt: next });

      const payload = await service.getDuePayload('u1');

      expect(payload.dueCount).toBe(0);
      expect(payload.puzzles).toEqual([]);
      expect(payload.nextDueAt).toBe(next.toISOString());
    });

    it('omits the next-due lookup when cards are already due', async () => {
      mockPrisma.puzzleReview.findMany.mockResolvedValue([{ puzzle: puzzle('A') }]);
      mockPrisma.puzzleReview.count.mockResolvedValue(3);

      const payload = await service.getDuePayload('u1');

      expect(payload.dueCount).toBe(3);
      expect(payload.puzzles).toHaveLength(1);
      expect(payload.nextDueAt).toBeNull();
      expect(mockPrisma.puzzleReview.findFirst).not.toHaveBeenCalled();
    });
  });
});

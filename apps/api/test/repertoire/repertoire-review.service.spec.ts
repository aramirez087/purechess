import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import type { RepertoireNodeDto } from '@purechess/shared';
import {
  DRILL_SESSION_LIMIT,
  RepertoireReviewService,
  enumerateLines,
} from '../../src/repertoire/repertoire-review.service';
import { PrismaService } from '../../src/database/prisma.service';

// --- A small white repertoire: 1.e4 with two black replies, e5 then c5; the
// e5 branch continues 2.Nf3 Nc6 (a deeper line). Two root→LEAF lines (only
// nodes with no children are leaves, so e5 is NOT a line — it continues):
//   path "0.0.0.0" -> e4 e5 Nf3 Nc6
//   path "0.1"     -> e4 c5
// Leaf paths are the scheduling keys.
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const F_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const F_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const F_NF3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
const F_NC6 = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
const F_C5 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

function tree(): RepertoireNodeDto {
  return {
    fen: START_FEN,
    san: '',
    uci: '',
    children: [
      {
        fen: F_E4,
        san: 'e4',
        uci: 'e2e4',
        children: [
          {
            fen: F_E5,
            san: 'e5',
            uci: 'e7e5',
            children: [
              {
                fen: F_NF3,
                san: 'Nf3',
                uci: 'g1f3',
                children: [{ fen: F_NC6, san: 'Nc6', uci: 'b8c6', children: [] }],
              },
            ],
          },
          { fen: F_C5, san: 'c5', uci: 'c7c5', children: [] },
        ],
      },
    ],
  };
}

const mockPrisma = {
  repertoire: { findUnique: jest.fn() },
  repertoireReview: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
};

function repRow(over: Record<string, unknown> = {}) {
  return {
    id: 'rep1',
    userId: 'userA',
    color: 'white',
    rootFen: START_FEN,
    treeJson: tree(),
    ...over,
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('RepertoireReviewService', () => {
  let service: RepertoireReviewService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [RepertoireReviewService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(RepertoireReviewService);
  });

  describe('enumerateLines (pure)', () => {
    it('enumerates every root→leaf path keyed by its leaf path', () => {
      const lines = enumerateLines(tree());
      const paths = lines.map((l) => l.nodePath).sort();
      // Only leaves (no children) are lines: e5 continues, so it is NOT a line.
      expect(paths).toEqual(['0.0.0.0', '0.1']);

      const deep = lines.find((l) => l.nodePath === '0.0.0.0')!;
      expect(deep.steps.map((s) => s.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
      expect(deep.steps[deep.steps.length - 1].fen).toBe(F_NC6);
    });

    it('returns no lines for a bare root', () => {
      expect(enumerateLines({ fen: START_FEN, san: '', uci: '', children: [] })).toEqual([]);
    });
  });

  describe('getDrillLines', () => {
    it('404s a missing or cross-user repertoire (no existence leak)', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(null);
      await expect(service.getDrillLines('userA', 'rep1')).rejects.toBeInstanceOf(
        NotFoundException,
      );

      mockPrisma.repertoire.findUnique.mockResolvedValue(repRow({ userId: 'someoneElse' }));
      await expect(service.getDrillLines('userA', 'rep1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      // Ownership rejected before any review read.
      expect(mockPrisma.repertoireReview.findMany).not.toHaveBeenCalled();
    });

    it('returns due lines first, then never-trained lines flagged new', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(repRow());
      const now = Date.now();
      // "0.1" has a due card (overdue 2 days). "0.0.0.0" has NO card -> new.
      mockPrisma.repertoireReview.findMany.mockResolvedValue([
        { nodePath: '0.1', dueAt: new Date(now - 2 * MS_PER_DAY) },
      ]);

      const result = await service.getDrillLines('userA', 'rep1');

      expect(result.repertoireId).toBe('rep1');
      expect(result.color).toBe('white');
      expect(result.dueLineCount).toBe(1);

      const paths = result.lines.map((l) => l.nodePath);
      // The due line leads; the never-trained leaf is also offered.
      expect(paths[0]).toBe('0.1');
      expect(paths).toContain('0.0.0.0');
      // The never-trained leaf is flagged new; the due one is not.
      expect(result.lines.find((l) => l.nodePath === '0.0.0.0')?.isNew).toBe(true);
      expect(result.lines.find((l) => l.nodePath === '0.1')?.isNew).toBe(false);
      // Steps carry the full move sequence with the rootFen.
      expect(result.lines[0].rootFen).toBe(START_FEN);
      const deep = result.lines.find((l) => l.nodePath === '0.0.0.0');
      expect(deep?.steps.map((s) => s.uci)).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6']);
    });

    it('orders multiple due lines most-overdue first', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(repRow());
      const now = Date.now();
      // Both real leaves have due cards; "0.0.0.0" is more overdue, so it leads.
      mockPrisma.repertoireReview.findMany.mockResolvedValue([
        { nodePath: '0.1', dueAt: new Date(now - 1 * MS_PER_DAY) },
        { nodePath: '0.0.0.0', dueAt: new Date(now - 5 * MS_PER_DAY) },
      ]);

      const result = await service.getDrillLines('userA', 'rep1');

      expect(result.dueLineCount).toBe(2);
      const paths = result.lines.map((l) => l.nodePath);
      expect(paths.indexOf('0.0.0.0')).toBeLessThan(paths.indexOf('0.1'));
    });

    it('ignores a stale due card whose leaf no longer exists in the tree', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(repRow());
      mockPrisma.repertoireReview.findMany.mockResolvedValue([
        { nodePath: '9.9.9', dueAt: new Date(Date.now() - MS_PER_DAY) }, // gone
      ]);
      const result = await service.getDrillLines('userA', 'rep1');
      expect(result.dueLineCount).toBe(0);
      expect(result.lines.every((l) => l.nodePath !== '9.9.9')).toBe(true);
      // All three real lines are new and offered.
      expect(result.lines.every((l) => l.isNew)).toBe(true);
    });

    it('caps the session at DRILL_SESSION_LIMIT', async () => {
      // A wide tree: 20 distinct first moves -> 20 leaf lines, none trained.
      const wide: RepertoireNodeDto = { fen: START_FEN, san: '', uci: '', children: [] };
      for (let i = 0; i < 20; i++) {
        wide.children.push({ fen: `f${i}`, san: `m${i}`, uci: `u${i}`, children: [] });
      }
      mockPrisma.repertoire.findUnique.mockResolvedValue(repRow({ treeJson: wide }));
      mockPrisma.repertoireReview.findMany.mockResolvedValue([]);

      const result = await service.getDrillLines('userA', 'rep1');
      expect(result.lines.length).toBe(DRILL_SESSION_LIMIT);
    });
  });

  describe('grade', () => {
    it('404s before grading a cross-user repertoire', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(repRow({ userId: 'other' }));
      await expect(service.grade('userA', 'rep1', '0.1', true)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockPrisma.repertoireReview.update).not.toHaveBeenCalled();
      expect(mockPrisma.repertoireReview.create).not.toHaveBeenCalled();
    });

    it('creates a card scheduled 1 day out on a clean first drill (good, rep 1)', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(repRow());
      mockPrisma.repertoireReview.findFirst.mockResolvedValue(null);
      mockPrisma.repertoireReview.create.mockResolvedValue({});

      const before = Date.now();
      const res = await service.grade('userA', 'rep1', '0.1', true);

      expect(mockPrisma.repertoireReview.create).toHaveBeenCalledTimes(1);
      const arg = mockPrisma.repertoireReview.create.mock.calls[0][0];
      // Shared scheduler: a brand-new card graded `good` -> reps 1, interval 1d.
      expect(arg.data).toMatchObject({
        userId: 'userA',
        repertoireId: 'rep1',
        nodePath: '0.1',
        intervalDays: 1,
        reps: 1,
        lapses: 0,
      });
      const due = new Date(arg.data.dueAt).getTime();
      expect(due).toBeGreaterThanOrEqual(before + MS_PER_DAY - 2000);
      expect(res.intervalDays).toBe(1);
      expect(res.nodePath).toBe('0.1');
    });

    it('reschedules an existing card forward via the shared scheduler (good, rep 3)', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(repRow());
      // rep 2 card at 6 days, ease 2.5 -> next `good` (rep 3) = round(6 * 2.5) = 15d.
      mockPrisma.repertoireReview.findFirst.mockResolvedValue({
        id: 'card1',
        intervalDays: 6,
        easeFactor: 2.5,
        reps: 2,
        lapses: 0,
      });
      mockPrisma.repertoireReview.update.mockResolvedValue({});

      const res = await service.grade('userA', 'rep1', '0.0', true);

      expect(mockPrisma.repertoireReview.create).not.toHaveBeenCalled();
      const arg = mockPrisma.repertoireReview.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'card1' });
      expect(arg.data).toMatchObject({ intervalDays: 15, reps: 3, lapses: 0 });
      expect(res.intervalDays).toBe(15);
    });

    it('lapses a card on a miss (correctFirstTry=false -> again)', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(repRow());
      mockPrisma.repertoireReview.findFirst.mockResolvedValue({
        id: 'card1',
        intervalDays: 15,
        easeFactor: 2.5,
        reps: 3,
        lapses: 0,
      });
      mockPrisma.repertoireReview.update.mockResolvedValue({});

      const res = await service.grade('userA', 'rep1', '0.0', false);

      const arg = mockPrisma.repertoireReview.update.mock.calls[0][0];
      // `again`: reps reset to 0, lapses +1, interval collapses to 1, ease 2.5 -> 2.3.
      expect(arg.data).toMatchObject({
        intervalDays: 1,
        reps: 0,
        lapses: 1,
        easeFactor: 2.3,
      });
      expect(res.intervalDays).toBe(1);
    });
  });

  describe('dueLineCount', () => {
    it('counts only this repertoire’s due cards for the user', async () => {
      mockPrisma.repertoireReview.count.mockResolvedValue(4);
      const n = await service.dueLineCount('userA', 'rep1');
      expect(n).toBe(4);
      const where = mockPrisma.repertoireReview.count.mock.calls[0][0].where;
      expect(where).toMatchObject({ userId: 'userA', repertoireId: 'rep1' });
      expect(where.dueAt.lte).toBeInstanceOf(Date);
    });
  });
});

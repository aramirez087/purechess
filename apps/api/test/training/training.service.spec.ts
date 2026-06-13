import { Test, TestingModule } from '@nestjs/testing';
import type { InsightDto, PuzzleSummaryDto } from '@purechess/shared';
import {
  TrainingService,
  trimToBudget,
  markDone,
  PLAN_MINUTES_BUDGET,
  THEME_PUZZLE_TARGET,
  REVIEW_TARGET_CAP,
} from '../../src/training/training.service';
import { PuzzleHistoryService } from '../../src/puzzles/puzzle-history.service';
import { PuzzleReviewService } from '../../src/puzzles/puzzle-review.service';
import { InsightsService } from '../../src/insights/insights.service';
import { PrismaService } from '../../src/database/prisma.service';
import { CLOCK, type Clock } from '../../src/training/clock';

const U = 'user-1';
const NOW = new Date('2026-06-13T09:00:00.000Z');
const TODAY_UTC = new Date('2026-06-13T00:00:00.000Z');

function summaryWith(over: Partial<PuzzleSummaryDto> = {}): PuzzleSummaryDto {
  return {
    puzzleRating: 1500,
    attempted: 50,
    solved: 30,
    accuracy: 0.6,
    weakestTheme: null,
    ...over,
  };
}

const EMPTY_INSIGHT: InsightDto = { weaknesses: [] };

/** Build the service with controllable dependencies. */
async function build(deps: {
  summary?: PuzzleSummaryDto;
  insight?: InsightDto;
  dueCount?: number;
  dailySolvedTodayCount?: number; // puzzleAttempt.count for daily/solved/today
  dayRow?: any; // trainingDay.findUnique
  dailyGoal?: number; // trainingStreak.dailyGoalPuzzles
}) {
  const history = { summary: jest.fn().mockResolvedValue(deps.summary ?? summaryWith()) };
  const review = { dueCount: jest.fn().mockResolvedValue(deps.dueCount ?? 0) };
  const insights = { getInsights: jest.fn().mockResolvedValue(deps.insight ?? EMPTY_INSIGHT) };
  const prisma = {
    puzzleAttempt: { count: jest.fn().mockResolvedValue(deps.dailySolvedTodayCount ?? 0) },
    trainingDay: { findUnique: jest.fn().mockResolvedValue(deps.dayRow ?? null) },
    trainingStreak: {
      findUnique: jest.fn().mockResolvedValue(
        deps.dailyGoal != null ? { dailyGoalPuzzles: deps.dailyGoal } : null,
      ),
    },
  };
  const clock: Clock = { now: () => NOW };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      TrainingService,
      { provide: PuzzleHistoryService, useValue: history },
      { provide: PuzzleReviewService, useValue: review },
      { provide: InsightsService, useValue: insights },
      { provide: PrismaService, useValue: prisma },
      { provide: CLOCK, useValue: clock },
    ],
  }).compile();

  return { service: module.get(TrainingService), prisma, history, review, insights };
}

describe('TrainingService.getPlan — assembly from live signals', () => {
  it('puts the daily puzzle first when it is unsolved today', async () => {
    const { service } = await build({ dailySolvedTodayCount: 0 });
    const plan = await service.getPlan(U);
    expect(plan.items[0]).toMatchObject({ kind: 'daily', href: '/puzzles', target: 1 });
    expect(plan.date).toBe('2026-06-13');
  });

  it('OMITS the daily puzzle item when already solved today', async () => {
    const { service } = await build({ dailySolvedTodayCount: 1 });
    const plan = await service.getPlan(U);
    expect(plan.items.some((i) => i.kind === 'daily')).toBe(false);
  });

  it('adds a weakest-theme item that deep-links into the theme trainer', async () => {
    const { service } = await build({
      summary: summaryWith({
        weakestTheme: { slug: 'fork', label: 'Forks', attempts: 20, solved: 6, accuracy: 0.3 },
      }),
    });
    const plan = await service.getPlan(U);
    const theme = plan.items.find((i) => i.kind === 'theme');
    expect(theme).toMatchObject({
      targetSlug: 'fork',
      target: THEME_PUZZLE_TARGET,
      href: '/puzzles/train?theme=fork',
    });
    expect(theme?.label).toContain('Forks');
  });

  it('adds a review item capped at REVIEW_TARGET_CAP when many are due', async () => {
    const { service } = await build({ dueCount: 42 });
    const plan = await service.getPlan(U);
    const review = plan.items.find((i) => i.kind === 'review');
    expect(review).toMatchObject({ target: REVIEW_TARGET_CAP, href: '/puzzles/review' });
  });

  it('omits the review item when nothing is due', async () => {
    const { service } = await build({ dueCount: 0 });
    const plan = await service.getPlan(U);
    expect(plan.items.some((i) => i.kind === 'review')).toBe(false);
  });

  it('adds an opening drill when the TOP insight is an opening leak', async () => {
    const { service } = await build({
      dailySolvedTodayCount: 1, // free up the budget so the drill survives the trim
      insight: {
        weaknesses: [
          {
            area: 'opening',
            kind: 'opening',
            label: "the Caro-Kann",
            title: 'Plug your Caro-Kann leak',
            actionHref: '/openings?repertoire=rep-1',
          },
        ],
      },
    });
    const plan = await service.getPlan(U);
    const opening = plan.items.find((i) => i.kind === 'opening');
    expect(opening).toMatchObject({ href: '/openings?repertoire=rep-1', target: 1 });
    expect(plan.items.some((i) => i.kind === 'endgame')).toBe(false);
  });

  it('adds an endgame drill when the TOP insight is an endgame gap', async () => {
    const { service } = await build({
      dailySolvedTodayCount: 1,
      insight: {
        weaknesses: [
          {
            area: 'endgame',
            kind: 'endgame',
            slug: 'rook',
            label: 'rook endgames',
            title: 'Rook endgames are costing you',
            actionHref: '/endgames?category=rook',
          },
        ],
      },
    });
    const plan = await service.getPlan(U);
    const eg = plan.items.find((i) => i.kind === 'endgame');
    expect(eg).toMatchObject({ targetSlug: 'rook', href: '/endgames?category=rook' });
  });

  it('does NOT add a drill when the top insight is a theme/time weakness', async () => {
    const { service } = await build({
      insight: {
        weaknesses: [{ area: 'theme', kind: 'theme', slug: 'fork', label: 'Forks' }],
      },
    });
    const plan = await service.getPlan(U);
    expect(plan.items.some((i) => i.kind === 'opening' || i.kind === 'endgame')).toBe(false);
  });

  it('respects the ~10-minute budget — trims lower-priority items that overflow', async () => {
    // daily(2) + theme(5) + review(3) = 10 exactly; the opening(3) would push to
    // 13 > 10, so it is trimmed away. Everything higher-priority stays.
    const { service } = await build({
      dailySolvedTodayCount: 0,
      dueCount: 10,
      summary: summaryWith({
        weakestTheme: { slug: 'pin', label: 'Pins', attempts: 30, solved: 9, accuracy: 0.3 },
      }),
      insight: {
        weaknesses: [
          { area: 'opening', kind: 'opening', label: 'a line', actionHref: '/openings?repertoire=r' },
        ],
      },
    });
    const plan = await service.getPlan(U);
    const kinds = plan.items.map((i) => i.kind);
    expect(kinds).toEqual(['daily', 'theme', 'review']); // opening trimmed
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(PLAN_MINUTES_BUDGET);
  });

  it('marks items done as the day TrainingDay counts accumulate', async () => {
    // The day has 6 puzzles, 3 reviews, 1 drill solved. daily(target 1) +
    // theme(target 5) consume puzzles in order: daily done (1), theme done (5).
    // review(target 5) gets 3 → not yet done. opening(target 1) gets 1 → done.
    const { service } = await build({
      dailySolvedTodayCount: 0,
      dueCount: 10,
      summary: summaryWith({
        weakestTheme: { slug: 'pin', label: 'Pins', attempts: 30, solved: 9, accuracy: 0.3 },
      }),
      dayRow: { puzzlesSolved: 6, reviewsDone: 3, drillsDone: 1 },
    });
    const plan = await service.getPlan(U);
    const byKind = Object.fromEntries(plan.items.map((i) => [i.kind, i]));
    expect(byKind.daily).toMatchObject({ doneToday: 1, completed: true });
    expect(byKind.theme).toMatchObject({ doneToday: 5, completed: true });
    expect(byKind.review).toMatchObject({ doneToday: 3, completed: false });
    expect(plan.puzzlesSolvedToday).toBe(6);
  });

  it('threads the daily goal through from the streak row', async () => {
    const { service } = await build({ dailyGoal: 3 });
    const plan = await service.getPlan(U);
    expect(plan.dailyGoalPuzzles).toBe(3);
  });

  it('queries daily-solved over the correct UTC day window', async () => {
    const { service, prisma } = await build({});
    await service.getPlan(U);
    const where = prisma.puzzleAttempt.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: U, source: 'daily', solved: true });
    expect(where.createdAt.gte).toEqual(TODAY_UTC);
    expect(where.createdAt.lt).toEqual(new Date('2026-06-14T00:00:00.000Z'));
  });
});

describe('TrainingService.progressToday', () => {
  it('reports the day counters and whether the puzzle goal is met', async () => {
    const { service } = await build({
      dayRow: { puzzlesSolved: 4, reviewsDone: 2, drillsDone: 1 },
      dailyGoal: 4,
    });
    const p = await service.progressToday(U);
    expect(p).toMatchObject({
      date: '2026-06-13',
      puzzlesSolved: 4,
      reviewsDone: 2,
      drillsDone: 1,
      dailyGoalPuzzles: 4,
      goalMet: true,
    });
  });
});

describe('trimToBudget (pure)', () => {
  const item = (kind: any, min: number) => ({ kind, label: kind, estimatedMinutes: min });

  it('keeps items in order until the next would exceed the budget', () => {
    const out = trimToBudget(
      [item('daily', 2), item('theme', 5), item('review', 3), item('opening', 3)],
      10,
    );
    expect(out.map((i) => i.kind)).toEqual(['daily', 'theme', 'review']);
  });

  it('always keeps the first item even if it alone exceeds the budget', () => {
    const out = trimToBudget([item('theme', 99), item('review', 1)], 10);
    expect(out.map((i) => i.kind)).toEqual(['theme']);
  });

  it('returns [] for no items', () => {
    expect(trimToBudget([], 10)).toEqual([]);
  });
});

describe('markDone (pure)', () => {
  const items = [
    { kind: 'daily' as const, label: 'd', target: 1 },
    { kind: 'theme' as const, label: 't', target: 5 },
    { kind: 'review' as const, label: 'r', target: 5 },
    { kind: 'endgame' as const, label: 'e', target: 1 },
  ];

  it('attributes puzzles to daily then theme, reviews to review, drills to drill kinds', () => {
    const out = markDone(items, {
      puzzlesSolved: 6,
      reviewsDone: 5,
      drillsDone: 1,
    } as any);
    expect(out[0]).toMatchObject({ doneToday: 1, completed: true }); // daily
    expect(out[1]).toMatchObject({ doneToday: 5, completed: true }); // theme
    expect(out[2]).toMatchObject({ doneToday: 5, completed: true }); // review
    expect(out[3]).toMatchObject({ doneToday: 1, completed: true }); // endgame
  });

  it('partial progress is not complete', () => {
    const out = markDone(items, { puzzlesSolved: 3, reviewsDone: 0, drillsDone: 0 } as any);
    expect(out[0]).toMatchObject({ doneToday: 1, completed: true }); // daily (1 of 1)
    expect(out[1]).toMatchObject({ doneToday: 2, completed: false }); // theme (2 of 5)
    expect(out[2]).toMatchObject({ doneToday: 0, completed: false }); // review
  });

  it('a null day → nothing done', () => {
    const out = markDone(items, null);
    expect(out.every((i) => i.doneToday === 0 && !i.completed)).toBe(true);
  });
});

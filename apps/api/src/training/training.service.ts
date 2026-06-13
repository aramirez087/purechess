import { Inject, Injectable } from '@nestjs/common';
import type { TrainingDay } from '@prisma/client';
import type {
  InsightDto,
  PuzzleSummaryDto,
  TrainingPlanDto,
  TrainingPlanItemDto,
} from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import { PuzzleHistoryService } from '../puzzles/puzzle-history.service';
import { PuzzleReviewService } from '../puzzles/puzzle-review.service';
import { InsightsService } from '../insights/insights.service';
import { CLOCK, type Clock } from './clock';
import { DEFAULT_DAILY_GOAL, dayKey, utcMidnight } from './streak.service';

/** Target wall-clock budget for the whole plan. The hub promises "~10 minutes". */
export const PLAN_MINUTES_BUDGET = 10;

/** Rough minute costs per item kind (drives the ~10-min cap). */
const MINUTES = {
  daily: 2,
  theme: 5, // a small set of weakest-theme puzzles
  review: 3,
  opening: 3,
  endgame: 3,
} as const;

/** How many weakest-theme puzzles a theme item asks for. */
export const THEME_PUZZLE_TARGET = 5;

/** Cap on how many due reviews a review item asks for (keeps the plan short). */
export const REVIEW_TARGET_CAP = 5;

/**
 * Assembles the daily ~10-minute training plan from LIVE signals and reports the
 * day's progress toward the goal. Read-only: it composes the existing services
 * (puzzle summary/weakest theme, the review queue, the insights engine) and the
 * day's `TrainingDay` counts — it writes nothing. Streak writes live in
 * {@link StreakService}; this service only reads activity to mark items done.
 */
@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: PuzzleHistoryService,
    private readonly review: PuzzleReviewService,
    private readonly insights: InsightsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Today's plan: the daily puzzle (if unsolved today), a few puzzles in the
   * user's weakest theme, the due spaced-repetition reviews (capped), and — when
   * the user's TOP insight is an opening or endgame — one drill of that kind.
   * Items are assembled in priority order and trimmed to the
   * {@link PLAN_MINUTES_BUDGET} cap, then each is marked done from the day's
   * `TrainingDay` counters.
   */
  async getPlan(userId: string): Promise<TrainingPlanDto> {
    const today = this.todayUtc();
    const [summary, insight, dueCount, dailySolvedToday, dayRow, goal] =
      await Promise.all([
        this.history.summary(userId),
        this.insights.getInsights(userId),
        this.review.dueCount(userId),
        this.dailySolvedToday(userId, today),
        this.dayRow(userId, today),
        this.dailyGoal(userId),
      ]);

    const items = this.assembleItems({
      summary,
      insight,
      dueCount,
      dailySolvedToday,
    });

    const trimmed = trimToBudget(items, PLAN_MINUTES_BUDGET);
    const withProgress = markDone(trimmed, dayRow);

    return {
      date: dayKey(today),
      items: withProgress,
      dailyGoalPuzzles: goal,
      puzzlesSolvedToday: dayRow?.puzzlesSolved ?? 0,
      estimatedMinutes: withProgress.reduce(
        (sum, it) => sum + (it.estimatedMinutes ?? 0),
        0,
      ),
    };
  }

  /**
   * Today's raw progress toward the daily goal: how many puzzles/reviews/drills
   * the user has done today and whether the puzzle goal is met. Drives the goal
   * ring on the hub.
   */
  async progressToday(userId: string): Promise<{
    date: string;
    puzzlesSolved: number;
    reviewsDone: number;
    drillsDone: number;
    dailyGoalPuzzles: number;
    goalMet: boolean;
  }> {
    const today = this.todayUtc();
    const [dayRow, goal] = await Promise.all([
      this.dayRow(userId, today),
      this.dailyGoal(userId),
    ]);
    const puzzlesSolved = dayRow?.puzzlesSolved ?? 0;
    return {
      date: dayKey(today),
      puzzlesSolved,
      reviewsDone: dayRow?.reviewsDone ?? 0,
      drillsDone: dayRow?.drillsDone ?? 0,
      dailyGoalPuzzles: goal,
      goalMet: puzzlesSolved >= goal,
    };
  }

  // --- assembly ------------------------------------------------------------

  /**
   * Build the ordered candidate items from the signals (before the budget trim).
   * Pure given its inputs — extracted so the assembly logic is unit-testable
   * without a DB. Order encodes priority: daily → weakest theme → reviews →
   * the top-insight drill (opening/endgame only).
   */
  assembleItems(input: {
    summary: PuzzleSummaryDto;
    insight: InsightDto;
    dueCount: number;
    dailySolvedToday: boolean;
  }): TrainingPlanItemDto[] {
    const items: TrainingPlanItemDto[] = [];

    // 1. The daily puzzle — only if the user hasn't solved it today.
    if (!input.dailySolvedToday) {
      items.push({
        kind: 'daily',
        label: 'Solve the daily puzzle',
        target: 1,
        count: 1,
        estimatedMinutes: MINUTES.daily,
        href: '/puzzles',
      });
    }

    // 2. A few puzzles in the user's weakest theme (high-confidence weakness).
    const weakest = input.summary.weakestTheme;
    if (weakest && typeof weakest.accuracy === 'number') {
      const name = weakest.label ?? weakest.slug;
      items.push({
        kind: 'theme',
        label: `Solve ${THEME_PUZZLE_TARGET} ${name} puzzles`,
        targetSlug: weakest.slug,
        target: THEME_PUZZLE_TARGET,
        count: THEME_PUZZLE_TARGET,
        estimatedMinutes: MINUTES.theme,
        href: `/puzzles/train?theme=${encodeURIComponent(weakest.slug)}`,
      });
    }

    // 3. Due spaced-repetition reviews (capped to keep the plan short).
    if (input.dueCount > 0) {
      const target = Math.min(input.dueCount, REVIEW_TARGET_CAP);
      items.push({
        kind: 'review',
        label: `Review ${target} ${target === 1 ? 'puzzle' : 'puzzles'} you missed`,
        target,
        count: target,
        estimatedMinutes: MINUTES.review,
        href: '/puzzles/review',
      });
    }

    // 4. One drill if the TOP insight is an opening or endgame leak.
    const top = input.insight.weaknesses[0];
    if (top?.kind === 'opening') {
      items.push({
        kind: 'opening',
        label: top.title ?? `Drill ${top.label}`,
        target: 1,
        count: 1,
        estimatedMinutes: MINUTES.opening,
        href: top.actionHref ?? '/openings',
      });
    } else if (top?.kind === 'endgame') {
      items.push({
        kind: 'endgame',
        label: top.title ?? `Practice ${top.label}`,
        targetSlug: top.slug,
        target: 1,
        count: 1,
        estimatedMinutes: MINUTES.endgame,
        href: top.actionHref ?? '/endgames',
      });
    }

    return items;
  }

  // --- reads ---------------------------------------------------------------

  /** Has the user solved the daily puzzle today (UTC)? Source-tagged attempt. */
  private async dailySolvedToday(userId: string, today: Date): Promise<boolean> {
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const solved = await this.prisma.puzzleAttempt.count({
      where: {
        userId,
        source: 'daily',
        solved: true,
        createdAt: { gte: today, lt: tomorrow },
      },
    });
    return solved > 0;
  }

  private dayRow(userId: string, today: Date): Promise<TrainingDay | null> {
    return this.prisma.trainingDay.findUnique({
      where: { userId_day: { userId, day: today } },
    });
  }

  private async dailyGoal(userId: string): Promise<number> {
    const streak = await this.prisma.trainingStreak.findUnique({
      where: { userId },
      select: { dailyGoalPuzzles: true },
    });
    return streak?.dailyGoalPuzzles ?? DEFAULT_DAILY_GOAL;
  }

  private todayUtc(): Date {
    return utcMidnight(this.clock.now());
  }
}

/**
 * Trim the ordered items so the total estimated minutes stays within `budget`.
 * Items are kept in priority order; once adding the next item would exceed the
 * budget we stop (an item is never split). The first item is always kept even
 * if it alone exceeds the budget, so the plan is never empty when there's work.
 * Pure + exported for unit testing the cap.
 */
export function trimToBudget(
  items: TrainingPlanItemDto[],
  budget: number,
): TrainingPlanItemDto[] {
  const kept: TrainingPlanItemDto[] = [];
  let spent = 0;
  for (const item of items) {
    const cost = item.estimatedMinutes ?? 0;
    if (kept.length > 0 && spent + cost > budget) break;
    kept.push(item);
    spent += cost;
  }
  return kept;
}

/**
 * Mark each item done from the day's `TrainingDay` counters. Counters are
 * AGGREGATE (the day's total puzzles/reviews/drills), not per-item, so progress
 * is attributed to items by kind in priority order: the day's `puzzlesSolved`
 * fills the daily + theme items (daily first, then theme); `reviewsDone` fills
 * the review item; `drillsDone` fills the opening/endgame item. An item is
 * `completed` once its `doneToday >= target`. Pure + exported for testing.
 */
export function markDone(
  items: TrainingPlanItemDto[],
  day: TrainingDay | null,
): TrainingPlanItemDto[] {
  let puzzlesLeft = day?.puzzlesSolved ?? 0;
  let reviewsLeft = day?.reviewsDone ?? 0;
  let drillsLeft = day?.drillsDone ?? 0;

  return items.map((item) => {
    const target = item.target ?? item.count ?? 1;
    let done = 0;
    if (item.kind === 'daily' || item.kind === 'theme') {
      done = Math.min(target, puzzlesLeft);
      puzzlesLeft -= done;
    } else if (item.kind === 'review') {
      done = Math.min(target, reviewsLeft);
      reviewsLeft -= done;
    } else if (item.kind === 'opening' || item.kind === 'endgame') {
      done = Math.min(target, drillsLeft);
      drillsLeft -= done;
    }
    return { ...item, doneToday: done, completed: done >= target };
  });
}

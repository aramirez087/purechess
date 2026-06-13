import { Inject, Injectable } from '@nestjs/common';
import type { TrainingDay, TrainingStreak } from '@prisma/client';
import type { TrainingDayDto, TrainingStreakDto } from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import { CLOCK, type Clock } from './clock';

/**
 * A single training action's kind. Each maps to a counter on `TrainingDay`:
 * `puzzle` → puzzlesSolved, `review` → reviewsDone, `drill` → drillsDone
 * (an opening-line drill or an endgame attempt both count as a drill).
 */
export type ActivityKind = 'puzzle' | 'review' | 'drill';

/** How many recent days the contribution calendar shows. */
export const CALENDAR_DAYS = 84; // 12 weeks — a GitHub-style grid.

/** The default daily puzzle goal when a user has no TrainingStreak row yet. */
export const DEFAULT_DAILY_GOAL = 10;

/**
 * Server-authoritative training streaks. The client reports raw activity
 * (a puzzle solved, a review done, a drill graded) and NEVER the computed
 * streak — this service owns the math.
 *
 * ## Day boundary — UTC (documented decision)
 *
 * A "training day" is a UTC calendar day (`YYYY-MM-DD` from `toISOString`). UTC
 * was chosen over user-local for three reasons:
 *   1. Consistency with the rest of the Improve epic — `bucketDailyClose`
 *      (puzzle rating history) and the frozen `@db.Date` columns
 *      (`TrainingDay.day`, `TrainingStreak.lastTrainedOn`) are already UTC.
 *   2. No trusted client input — the server never reads a client timezone, so a
 *      streak can't be gamed by spoofing the local clock (operator rule:
 *      server-authoritative for anything scored).
 *   3. Determinism in tests — the injected {@link Clock} pins `now()`, and the
 *      day key is a pure function of it.
 * The cost is a player near a UTC midnight may see the day flip mid-evening; for
 * a global, untrusted, scored streak that's the right trade. (A future
 * per-user-tz refinement would store the tz and shift the key — no schema
 * change needed here.)
 *
 * ## Streak rules
 *   - The streak advances AT MOST ONCE PER DAY. The first activity of a UTC day
 *     bumps it; every later activity that same day only increments the day's
 *     counters, never the streak (no double counting).
 *   - First-ever activity → currentStreak = 1.
 *   - First activity of a day whose PREVIOUS active day was YESTERDAY →
 *     currentStreak + 1.
 *   - First activity of a day with a GAP (last active day before yesterday) →
 *     currentStreak resets to 1.
 *   - `longestStreak` is bumped whenever currentStreak exceeds it.
 */
@Injectable()
export class StreakService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Record one training action and advance the streak. Idempotent within a day
   * for the STREAK (it bumps at most once per UTC day); the per-kind COUNTER is
   * always incremented by `count`. Returns the fresh streak snapshot.
   *
   * Called best-effort from the existing recorders (puzzle solved, review
   * graded, drill graded) via an `@Optional()` injection — a streak write must
   * never fail the underlying training action, so callers wrap this in try/catch.
   */
  async recordActivity(
    userId: string,
    kind: ActivityKind,
    count = 1,
  ): Promise<TrainingStreakDto> {
    const inc = Math.max(0, Math.trunc(count));
    const today = this.todayUtc();

    // Is this the user's FIRST activity today? Decided BEFORE the upsert so a
    // second action the same day doesn't re-trigger the streak bump.
    const existingDay = await this.prisma.trainingDay.findUnique({
      where: { userId_day: { userId, day: today } },
      select: { id: true },
    });
    const firstActivityToday = !existingDay;

    // Upsert the day row, incrementing the kind's counter.
    await this.prisma.trainingDay.upsert({
      where: { userId_day: { userId, day: today } },
      create: {
        userId,
        day: today,
        puzzlesSolved: kind === 'puzzle' ? inc : 0,
        reviewsDone: kind === 'review' ? inc : 0,
        drillsDone: kind === 'drill' ? inc : 0,
      },
      update: counterUpdate(kind, inc),
    });

    const streak = await this.advanceStreak(userId, today, firstActivityToday);
    return this.toStreakDto(streak, await this.recentDays(userId));
  }

  /**
   * The user's streak snapshot plus the recent day rows for the contribution
   * calendar. Creates no rows — a never-trained user gets a zeroed default.
   */
  async get(userId: string): Promise<TrainingStreakDto> {
    const [streak, days] = await Promise.all([
      this.prisma.trainingStreak.findUnique({ where: { userId } }),
      this.recentDays(userId),
    ]);
    return this.toStreakDto(streak, days);
  }

  /**
   * Set the user's daily puzzle goal (clamped 1..50). Upserts the streak row so
   * the goal persists even before the user has trained.
   */
  async setDailyGoal(userId: string, goal: number): Promise<TrainingStreakDto> {
    const clamped = Math.min(50, Math.max(1, Math.trunc(goal)));
    const streak = await this.prisma.trainingStreak.upsert({
      where: { userId },
      create: { userId, dailyGoalPuzzles: clamped },
      update: { dailyGoalPuzzles: clamped },
    });
    return this.toStreakDto(streak, await this.recentDays(userId));
  }

  // --- internals -----------------------------------------------------------

  /**
   * Advance (or reset) the streak for the user. Only the FIRST activity of a UTC
   * day changes the streak; later activities pass `firstActivityToday=false` and
   * we leave currentStreak alone (still touching the row so `updatedAt` moves
   * and the default exists). Returns the persisted streak.
   */
  private async advanceStreak(
    userId: string,
    today: Date,
    firstActivityToday: boolean,
  ): Promise<TrainingStreak> {
    const prev = await this.prisma.trainingStreak.findUnique({ where: { userId } });

    if (!firstActivityToday && prev) {
      // Subsequent action the same day — no streak change.
      return prev;
    }

    const last = prev?.lastTrainedOn ?? null;
    let current: number;
    if (last && sameUtcDay(last, today)) {
      // Already counted today (e.g. the streak row was bumped by another action
      // before this day row existed — defensive). Keep current.
      current = prev?.currentStreak ?? 1;
    } else if (last && isYesterdayUtc(last, today)) {
      current = (prev?.currentStreak ?? 0) + 1;
    } else {
      // First-ever activity OR a gap of 2+ days → restart at 1.
      current = 1;
    }

    const longest = Math.max(prev?.longestStreak ?? 0, current);

    return this.prisma.trainingStreak.upsert({
      where: { userId },
      create: {
        userId,
        currentStreak: current,
        longestStreak: longest,
        lastTrainedOn: today,
        dailyGoalPuzzles: DEFAULT_DAILY_GOAL,
      },
      update: {
        currentStreak: current,
        longestStreak: longest,
        lastTrainedOn: today,
      },
    });
  }

  /** Recent TrainingDay rows (newest-first), capped at {@link CALENDAR_DAYS}. */
  private async recentDays(userId: string): Promise<TrainingDay[]> {
    const since = new Date(this.todayUtc());
    since.setUTCDate(since.getUTCDate() - (CALENDAR_DAYS - 1));
    return this.prisma.trainingDay.findMany({
      where: { userId, day: { gte: since } },
      orderBy: { day: 'desc' },
    });
  }

  /** Today as a UTC-midnight Date (matches the `@db.Date` storage). */
  private todayUtc(): Date {
    return utcMidnight(this.clock.now());
  }

  private toStreakDto(
    streak: TrainingStreak | null,
    days: TrainingDay[],
  ): TrainingStreakDto {
    const today = this.todayUtc();
    const goal = streak?.dailyGoalPuzzles ?? DEFAULT_DAILY_GOAL;
    const todayRow = days.find((d) => sameUtcDay(d.day, today)) ?? null;
    const puzzlesToday = todayRow?.puzzlesSolved ?? 0;

    return {
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      lastTrainedOn: streak?.lastTrainedOn
        ? dayKey(streak.lastTrainedOn)
        : null,
      dailyGoalPuzzles: goal,
      goalMetToday: puzzlesToday >= goal,
      history: days.map(toTrainingDayDto),
    };
  }
}

/** The Prisma `update` payload that increments the counter for `kind`. */
function counterUpdate(kind: ActivityKind, inc: number) {
  switch (kind) {
    case 'puzzle':
      return { puzzlesSolved: { increment: inc } };
    case 'review':
      return { reviewsDone: { increment: inc } };
    case 'drill':
      return { drillsDone: { increment: inc } };
  }
}

/** A row → `TrainingDayDto` (the `day` rendered as a UTC YYYY-MM-DD key). */
function toTrainingDayDto(d: TrainingDay): TrainingDayDto {
  return {
    day: dayKey(d.day),
    puzzlesSolved: d.puzzlesSolved,
    reviewsDone: d.reviewsDone,
    drillsDone: d.drillsDone,
  };
}

/** The UTC `YYYY-MM-DD` key of a Date. The streak's unit of time. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Midnight-UTC of the given instant's calendar day (for `@db.Date` writes). */
export function utcMidnight(date: Date): Date {
  return new Date(`${dayKey(date)}T00:00:00.000Z`);
}

/** True iff both dates fall on the same UTC calendar day. */
export function sameUtcDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** True iff `earlier` is exactly the UTC day before `day`. */
export function isYesterdayUtc(earlier: Date, day: Date): boolean {
  const yesterday = new Date(utcMidnight(day));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return sameUtcDay(earlier, yesterday);
}

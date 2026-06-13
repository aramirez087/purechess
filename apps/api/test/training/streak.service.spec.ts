import { Test, TestingModule } from '@nestjs/testing';
import {
  StreakService,
  dayKey,
  isYesterdayUtc,
  sameUtcDay,
  utcMidnight,
} from '../../src/training/streak.service';
import { CLOCK, type Clock } from '../../src/training/clock';
import { PrismaService } from '../../src/database/prisma.service';
import { PosthogService } from '../../src/analytics/posthog.service';

/**
 * An in-memory model of the two Prisma tables the streak service touches, so the
 * spec asserts PERSISTED values (currentStreak/longestStreak/lastTrainedOn and
 * the per-kind counters), not just that a mock was called. The store keys days
 * by the UTC `YYYY-MM-DD` (matching the `@db.Date` storage) so cross-day math is
 * exercised exactly as production sees it.
 */
function makeStore() {
  const streaks = new Map<string, any>();
  const days = new Map<string, any>(); // key = `${userId}|${dayKey}`

  const dk = (d: Date) => dayKey(d);

  const prisma = {
    trainingStreak: {
      findUnique: jest.fn(async ({ where }: any) => streaks.get(where.userId) ?? null),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = streaks.get(where.userId);
        const row = existing ? { ...existing, ...update } : { ...create };
        streaks.set(where.userId, row);
        return row;
      }),
    },
    trainingDay: {
      findUnique: jest.fn(async ({ where }: any) => {
        const key = `${where.userId_day.userId}|${dk(where.userId_day.day)}`;
        return days.get(key) ?? null;
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const key = `${where.userId_day.userId}|${dk(where.userId_day.day)}`;
        const existing = days.get(key);
        if (!existing) {
          const row = { id: key, ...create };
          days.set(key, row);
          return row;
        }
        const next = { ...existing };
        for (const field of ['puzzlesSolved', 'reviewsDone', 'drillsDone'] as const) {
          if (update[field]?.increment != null) {
            next[field] = (next[field] ?? 0) + update[field].increment;
          }
        }
        days.set(key, next);
        return next;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const since = where.day?.gte ? dk(where.day.gte) : '0000-00-00';
        return [...days.values()]
          .filter((d) => d.userId === where.userId && dk(d.day) >= since)
          .sort((a, b) => dk(b.day).localeCompare(dk(a.day)));
      }),
    },
  };

  return { prisma, streaks, days };
}

/** A clock pinned to a mutable instant the test advances day-by-day. */
function pinnedClock(initial: Date): Clock & { set(d: Date): void } {
  let current = initial;
  return {
    now: () => current,
    set: (d: Date) => {
      current = d;
    },
  };
}

const U = 'user-1';

async function build(clock: Clock, prisma: any, posthog?: any): Promise<StreakService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      StreakService,
      { provide: PrismaService, useValue: prisma },
      { provide: CLOCK, useValue: clock },
      ...(posthog ? [{ provide: PosthogService, useValue: posthog }] : []),
    ],
  }).compile();
  return module.get(StreakService);
}

describe('StreakService — date helpers (pure)', () => {
  it('dayKey is the UTC YYYY-MM-DD regardless of intra-day time', () => {
    expect(dayKey(new Date('2026-06-13T23:59:59.000Z'))).toBe('2026-06-13');
    expect(dayKey(new Date('2026-06-13T00:00:00.000Z'))).toBe('2026-06-13');
  });

  it('utcMidnight collapses to 00:00:00Z of the same UTC day', () => {
    expect(utcMidnight(new Date('2026-06-13T18:30:00.000Z')).toISOString()).toBe(
      '2026-06-13T00:00:00.000Z',
    );
  });

  it('sameUtcDay / isYesterdayUtc treat boundaries by UTC day, not local', () => {
    const today = new Date('2026-06-13T12:00:00.000Z');
    const yesterday = new Date('2026-06-12T23:30:00.000Z');
    const twoAgo = new Date('2026-06-11T00:00:00.000Z');
    expect(sameUtcDay(today, new Date('2026-06-13T00:01:00.000Z'))).toBe(true);
    expect(isYesterdayUtc(yesterday, today)).toBe(true);
    expect(isYesterdayUtc(twoAgo, today)).toBe(false); // a gap, not yesterday
    // Month rollover: May 31 is "yesterday" of June 1.
    expect(
      isYesterdayUtc(new Date('2026-05-31T20:00:00.000Z'), new Date('2026-06-01T05:00:00.000Z')),
    ).toBe(true);
  });
});

describe('StreakService.recordActivity — streak math', () => {
  it('first-ever activity starts the streak at 1 and sets longest=1', async () => {
    const { prisma, streaks, days } = makeStore();
    const clock = pinnedClock(new Date('2026-06-13T09:00:00.000Z'));
    const svc = await build(clock, prisma);

    const dto = await svc.recordActivity(U, 'puzzle');

    expect(dto.currentStreak).toBe(1);
    expect(dto.longestStreak).toBe(1);
    expect(dto.lastTrainedOn).toBe('2026-06-13');
    // The day counter was incremented and persisted.
    expect(days.get(`${U}|2026-06-13`).puzzlesSolved).toBe(1);
    expect(streaks.get(U).currentStreak).toBe(1);
  });

  it('consecutive UTC days increment the streak and bump longest', async () => {
    const { prisma, streaks } = makeStore();
    const clock = pinnedClock(new Date('2026-06-13T09:00:00.000Z'));
    const svc = await build(clock, prisma);

    await svc.recordActivity(U, 'puzzle'); // day 1 → streak 1
    clock.set(new Date('2026-06-14T08:00:00.000Z'));
    await svc.recordActivity(U, 'review'); // day 2 → streak 2
    clock.set(new Date('2026-06-15T20:00:00.000Z'));
    const dto = await svc.recordActivity(U, 'drill'); // day 3 → streak 3

    expect(dto.currentStreak).toBe(3);
    expect(dto.longestStreak).toBe(3);
    expect(streaks.get(U).lastTrainedOn).toEqual(utcMidnight(clock.now()));
  });

  it('a missed day resets the streak to 1 but KEEPS the longest', async () => {
    const { prisma } = makeStore();
    const clock = pinnedClock(new Date('2026-06-13T09:00:00.000Z'));
    const svc = await build(clock, prisma);

    await svc.recordActivity(U, 'puzzle'); // streak 1
    clock.set(new Date('2026-06-14T09:00:00.000Z'));
    await svc.recordActivity(U, 'puzzle'); // streak 2 (longest 2)
    // Skip the 15th entirely — train again on the 16th (a 1-day gap).
    clock.set(new Date('2026-06-16T09:00:00.000Z'));
    const dto = await svc.recordActivity(U, 'puzzle');

    expect(dto.currentStreak).toBe(1); // reset
    expect(dto.longestStreak).toBe(2); // preserved
  });

  it('same-day actions do NOT double-count the streak (only the counter grows)', async () => {
    const { prisma, days } = makeStore();
    const clock = pinnedClock(new Date('2026-06-13T09:00:00.000Z'));
    const svc = await build(clock, prisma);

    await svc.recordActivity(U, 'puzzle'); // streak 1, puzzles=1
    // Three more actions the SAME UTC day (even at 23:59) — streak stays 1.
    clock.set(new Date('2026-06-13T12:00:00.000Z'));
    await svc.recordActivity(U, 'puzzle');
    clock.set(new Date('2026-06-13T23:59:00.000Z'));
    await svc.recordActivity(U, 'review');
    const dto = await svc.recordActivity(U, 'drill');

    expect(dto.currentStreak).toBe(1); // never double-counted
    expect(dto.longestStreak).toBe(1);
    const row = days.get(`${U}|2026-06-13`);
    expect(row.puzzlesSolved).toBe(2); // two puzzle actions
    expect(row.reviewsDone).toBe(1);
    expect(row.drillsDone).toBe(1);
  });

  it('respects the injected clock for the day boundary (a midnight-UTC flip)', async () => {
    const { prisma } = makeStore();
    // 23:59:59Z on the 13th, then 00:00:30Z on the 14th — two distinct UTC days
    // back to back, so the streak advances to 2 despite ~30s of real time.
    const clock = pinnedClock(new Date('2026-06-13T23:59:59.000Z'));
    const svc = await build(clock, prisma);

    await svc.recordActivity(U, 'puzzle'); // day 13 → streak 1
    clock.set(new Date('2026-06-14T00:00:30.000Z'));
    const dto = await svc.recordActivity(U, 'puzzle'); // day 14 → streak 2

    expect(dto.currentStreak).toBe(2);
    expect(dto.lastTrainedOn).toBe('2026-06-14');
  });

  it('count > 1 increments the day counter by that amount (streak still once)', async () => {
    const { prisma, days } = makeStore();
    const clock = pinnedClock(new Date('2026-06-13T09:00:00.000Z'));
    const svc = await build(clock, prisma);

    const dto = await svc.recordActivity(U, 'puzzle', 5);

    expect(dto.currentStreak).toBe(1);
    expect(days.get(`${U}|2026-06-13`).puzzlesSolved).toBe(5);
  });
});

describe('StreakService.get / setDailyGoal', () => {
  it('get on a never-trained user returns a zeroed default (creates no rows)', async () => {
    const { prisma, streaks, days } = makeStore();
    const clock = pinnedClock(new Date('2026-06-13T09:00:00.000Z'));
    const svc = await build(clock, prisma);

    const dto = await svc.get(U);

    expect(dto.currentStreak).toBe(0);
    expect(dto.longestStreak).toBe(0);
    expect(dto.lastTrainedOn).toBeNull();
    expect(dto.dailyGoalPuzzles).toBe(10);
    expect(dto.history).toEqual([]);
    expect(streaks.size).toBe(0);
    expect(days.size).toBe(0);
  });

  it('goalMetToday flips once the day puzzle count reaches the goal', async () => {
    const { prisma } = makeStore();
    const clock = pinnedClock(new Date('2026-06-13T09:00:00.000Z'));
    const svc = await build(clock, prisma);

    await svc.setDailyGoal(U, 2);
    await svc.recordActivity(U, 'puzzle');
    let dto = await svc.get(U);
    expect(dto.goalMetToday).toBe(false);

    await svc.recordActivity(U, 'puzzle');
    dto = await svc.get(U);
    expect(dto.goalMetToday).toBe(true);
    expect(dto.dailyGoalPuzzles).toBe(2);
  });

  it('setDailyGoal clamps to 1..50', async () => {
    const { prisma } = makeStore();
    const clock = pinnedClock(new Date('2026-06-13T09:00:00.000Z'));
    const svc = await build(clock, prisma);

    expect((await svc.setDailyGoal(U, 0)).dailyGoalPuzzles).toBe(1);
    expect((await svc.setDailyGoal(U, 999)).dailyGoalPuzzles).toBe(50);
    expect((await svc.setDailyGoal(U, 7)).dailyGoalPuzzles).toBe(7);
  });

  it('history is newest-first and carries the per-kind counters', async () => {
    const { prisma } = makeStore();
    const clock = pinnedClock(new Date('2026-06-13T09:00:00.000Z'));
    const svc = await build(clock, prisma);

    await svc.recordActivity(U, 'puzzle');
    clock.set(new Date('2026-06-14T09:00:00.000Z'));
    await svc.recordActivity(U, 'review');

    const dto = await svc.get(U);
    expect(dto.history?.map((d) => d.day)).toEqual(['2026-06-14', '2026-06-13']);
    expect(dto.history?.[0]).toMatchObject({ reviewsDone: 1, puzzlesSolved: 0 });
    expect(dto.history?.[1]).toMatchObject({ puzzlesSolved: 1, reviewsDone: 0 });
  });
});

describe('StreakService — streak_advanced analytics', () => {
  it('fires streak_advanced{n} ONLY when the streak grows (not on same-day repeats)', async () => {
    const { prisma } = makeStore();
    const clock = pinnedClock(new Date('2026-06-13T09:00:00.000Z'));
    const posthog = { captureEvent: jest.fn() };
    const svc = await build(clock, prisma, posthog);

    // Day 1, first activity → streak 1, event {n:1}.
    await svc.recordActivity(U, 'puzzle');
    expect(posthog.captureEvent).toHaveBeenCalledTimes(1);
    expect(posthog.captureEvent).toHaveBeenLastCalledWith(U, 'streak_advanced', { n: 1 });

    // Day 1, SECOND activity → no streak change → NO new event.
    await svc.recordActivity(U, 'review');
    expect(posthog.captureEvent).toHaveBeenCalledTimes(1);

    // Day 2 → streak 2, event {n:2}.
    clock.set(new Date('2026-06-14T09:00:00.000Z'));
    await svc.recordActivity(U, 'puzzle');
    expect(posthog.captureEvent).toHaveBeenCalledTimes(2);
    expect(posthog.captureEvent).toHaveBeenLastCalledWith(U, 'streak_advanced', { n: 2 });
  });

  it('does NOT fire when a gap resets the streak back to its prior value', async () => {
    const { prisma } = makeStore();
    const clock = pinnedClock(new Date('2026-06-13T09:00:00.000Z'));
    const posthog = { captureEvent: jest.fn() };
    const svc = await build(clock, prisma, posthog);

    await svc.recordActivity(U, 'puzzle'); // streak 1 → event {n:1}
    posthog.captureEvent.mockClear();

    // A 3-day gap → streak resets to 1 (was already 1) → not a growth → no event.
    clock.set(new Date('2026-06-17T09:00:00.000Z'));
    await svc.recordActivity(U, 'puzzle');
    expect(posthog.captureEvent).not.toHaveBeenCalled();
  });

  it('works without PosthogService wired (Optional injection)', async () => {
    const { prisma } = makeStore();
    const clock = pinnedClock(new Date('2026-06-13T09:00:00.000Z'));
    const svc = await build(clock, prisma); // no posthog
    await expect(svc.recordActivity(U, 'puzzle')).resolves.toMatchObject({ currentStreak: 1 });
  });
});

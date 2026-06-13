import { Injectable } from '@nestjs/common';
import type {
  PuzzleHistoryDto,
  PuzzleRatingPointDto,
  PuzzleSummaryDto,
  PuzzleThemeStatDto,
} from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import { PuzzleRatingService } from './puzzle-rating.service';
import { PuzzleServingService } from './puzzle-serving.service';

/**
 * Hard cap on the number of points the rating curve ever returns, regardless of
 * how many attempts the user has. A heavy user can rack up tens of thousands of
 * attempts; the chart only needs a readable trend, so we pull at most this many
 * of the MOST RECENT rated attempts and then bucket them further (see below).
 */
const MAX_RATING_POINTS = 200;

/** Minimum attempts on a theme before it's eligible as "weakest" (signal floor). */
const WEAKEST_MIN_ATTEMPTS = 5;

/**
 * Derives the user's puzzle-rating curve and headline summary for the stats
 * surface. Reads `PuzzleAttempt.ratingAfterUser` over time (the per-attempt
 * rating trail S03 stamps onto every attempt) and the per-theme accuracy
 * roll-up from {@link PuzzleServingService.getStats}.
 *
 * Bucketing (documented contract — the chart and S12/S13 depend on it):
 *   1. Pull at most {@link MAX_RATING_POINTS} of the user's MOST RECENT attempts
 *      that carry a non-null `ratingAfterUser` (oldest-first after the slice).
 *      This is the hard cap — the series length never exceeds this.
 *   2. Collapse attempts that fall on the same CALENDAR DAY (UTC) into a single
 *      daily-close point (the last attempt of that day). A user who solves 300
 *      puzzles in one day contributes ONE point for that day, not 300.
 * The net effect: a curve that's at most `min(MAX_RATING_POINTS, distinctDays)`
 * points — bounded and readable — while still preserving the newest movements.
 */
@Injectable()
export class PuzzleHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratingService: PuzzleRatingService,
    private readonly serving: PuzzleServingService,
  ) {}

  /** Both the rating curve and the headline summary in one shot. */
  async history(userId: string): Promise<PuzzleHistoryDto> {
    const [ratingHistory, summary] = await Promise.all([
      this.ratingHistory(userId),
      this.summary(userId),
    ]);
    return { ratingHistory, summary };
  }

  /**
   * The puzzle-rating curve, oldest-first, capped + daily-close bucketed (see
   * the class doc). Returns `[]` when the user has no rated attempts.
   */
  async ratingHistory(userId: string): Promise<PuzzleRatingPointDto[]> {
    // Pull the newest N rated attempts, then re-order oldest-first. Selecting
    // newest-first (with the [userId, createdAt] index) and taking the cap
    // guarantees a bounded read even for a user with 50k attempts.
    const rows = await this.prisma.puzzleAttempt.findMany({
      where: { userId, ratingAfterUser: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: MAX_RATING_POINTS,
      select: { ratingAfterUser: true, createdAt: true },
    });
    rows.reverse(); // oldest-first for the curve

    return bucketDailyClose(
      rows.map((r) => ({
        rating: r.ratingAfterUser as number,
        at: r.createdAt,
      })),
    );
  }

  /**
   * Headline numbers: current puzzle rating, attempts/solved/accuracy, and the
   * single weakest theme to practice next. The weakest-theme selector mirrors
   * the serving stats ordering (accuracy ASC, larger sample as tie-break) but
   * additionally requires {@link WEAKEST_MIN_ATTEMPTS} attempts so a one-off
   * miss on a rare theme doesn't masquerade as the user's biggest weakness.
   */
  async summary(userId: string): Promise<PuzzleSummaryDto> {
    const [rating, stats, attempted, solved] = await Promise.all([
      this.ratingService.get(userId),
      this.serving.getStats(userId),
      this.prisma.puzzleAttempt.count({ where: { userId } }),
      this.prisma.puzzleAttempt.count({ where: { userId, solved: true } }),
    ]);

    return {
      puzzleRating: Math.round(rating.rating),
      attempted,
      solved,
      accuracy: attempted > 0 ? solved / attempted : undefined,
      weakestTheme: selectWeakestTheme(stats),
    };
  }
}

/**
 * Collapses points on the same UTC calendar day into one daily-close point
 * (the last point of that day). Input must be oldest-first; output preserves
 * that order. Pure + exported for unit testing the bucketing cap.
 */
export function bucketDailyClose(
  points: { rating: number; at: Date | string }[],
): PuzzleRatingPointDto[] {
  const byDay = new Map<string, { rating: number; at: string }>();
  for (const p of points) {
    const at = typeof p.at === 'string' ? new Date(p.at) : p.at;
    // UTC day key — same calendar day collapses regardless of attempt order.
    const dayKey = at.toISOString().slice(0, 10);
    // Last write per day wins → the day's closing rating.
    byDay.set(dayKey, { rating: Math.round(p.rating), at: at.toISOString() });
  }
  // Map insertion order follows first-seen order, which (input being
  // oldest-first) is already chronological by day.
  return [...byDay.values()];
}

/**
 * The single weakest theme to drill next, or null when none qualifies. Accuracy
 * ASC over themes with at least {@link WEAKEST_MIN_ATTEMPTS} attempts; tie-break
 * by larger sample (more confident the weakness is real), then slug. `getStats`
 * already sorts accuracy-ASC, but we re-derive here so the min-attempts floor is
 * enforced independently of that ordering. Exported for unit testing.
 */
export function selectWeakestTheme(
  stats: PuzzleThemeStatDto[],
): PuzzleThemeStatDto | null {
  const eligible = stats
    .filter((s) => s.attempts >= WEAKEST_MIN_ATTEMPTS && typeof s.accuracy === 'number')
    .sort((a, b) => {
      const aa = a.accuracy as number;
      const ba = b.accuracy as number;
      if (aa !== ba) return aa - ba;
      if (a.attempts !== b.attempts) return b.attempts - a.attempts;
      return a.slug.localeCompare(b.slug);
    });
  return eligible[0] ?? null;
}

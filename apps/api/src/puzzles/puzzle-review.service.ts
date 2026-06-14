import { Injectable, Logger, Optional } from '@nestjs/common';
import type { PuzzleDto, ReviewDueDto, ReviewGradeResultDto } from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import { StreakService } from '../training/streak.service';
import { offsetDays, schedule, toCardState, type ReviewGrade } from './spaced-repetition';

/** Default page size for the due queue. */
const DEFAULT_DUE_LIMIT = 20;

/**
 * Graduation threshold. Once a card's scheduling interval grows past this many
 * days, the puzzle is considered "learned" and removed from the review queue —
 * it no longer comes back. 30 days is the SM-2/Anki convention for "mature":
 * a tactic you can reproduce a month later is no longer the bottleneck.
 */
export const GRADUATION_INTERVAL_DAYS = 30;

/** A solve faster than this (ms) is graded `easy` rather than `good`. */
const EASY_MS_THRESHOLD = 8000;

/**
 * Owns the spaced-repetition review queue: the SM-2 {@link schedule} arithmetic
 * persisted over the `PuzzleReview` table. A failed puzzle (any mode) is
 * enqueued due tomorrow; the user works the due queue oldest-first; each grade
 * reschedules the card forward (or fails it back to ~1 day), and a card that
 * grows past {@link GRADUATION_INTERVAL_DAYS} graduates out.
 *
 * The (userId, dueAt) index on `PuzzleReview` drives both {@link getDue} and
 * {@link dueCount} — the two hot reads. All writes are upserts/updates keyed by
 * the `(userId, puzzleId)` unique, so they are idempotent and race-safe.
 */
@Injectable()
export class PuzzleReviewService {
  private readonly logger = new Logger(PuzzleReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Optional, best-effort streak hook — provided via StreakModule in the wired
    // app, absent (no-op) in the review unit spec.
    @Optional() private readonly streakService?: StreakService,
  ) {}

  /**
   * Enqueue a failed puzzle for review tomorrow. Idempotent per (user, puzzle):
   * the first failure inserts a fresh card due in ~1 day (the SM-2 lapse
   * interval), a repeat failure on an already-queued card re-lapses it (resets reps,
   * increments lapses, pulls it back to tomorrow). Called from the serving
   * service's `recordAttempt` when `solved === false` — additive, fire-safe.
   */
  async enqueueOnFail(userId: string, puzzleId: string): Promise<void> {
    const existing = await this.prisma.puzzleReview.findUnique({
      where: { userId_puzzleId: { userId, puzzleId } },
      select: { intervalDays: true, easeFactor: true, reps: true, lapses: true },
    });

    const next = schedule(toCardState(existing), 'again');
    const dueAt = offsetDays(next.nextDueOffsetDays);

    await this.prisma.puzzleReview.upsert({
      where: { userId_puzzleId: { userId, puzzleId } },
      create: {
        userId,
        puzzleId,
        dueAt,
        intervalDays: next.intervalDays,
        easeFactor: next.easeFactor,
        reps: next.reps,
        lapses: next.lapses,
      },
      update: {
        dueAt,
        intervalDays: next.intervalDays,
        easeFactor: next.easeFactor,
        reps: next.reps,
        lapses: next.lapses,
      },
    });
  }

  /**
   * Due cards for the user, oldest-first (most overdue leads), joined to the
   * puzzle. Uses the (userId, dueAt) index. `limit` caps the page; the true due
   * total is reported separately by {@link dueCount}.
   */
  async getDue(userId: string, limit = DEFAULT_DUE_LIMIT): Promise<PuzzleDto[]> {
    const rows = await this.prisma.puzzleReview.findMany({
      where: { userId, dueAt: { lte: new Date() } },
      orderBy: { dueAt: 'asc' },
      take: limit,
      select: { puzzle: true },
    });
    return rows.map((r) => toPuzzleDto(r.puzzle));
  }

  /** Count of cards due now (for the hub badge in S13). */
  dueCount(userId: string): Promise<number> {
    return this.prisma.puzzleReview.count({
      where: { userId, dueAt: { lte: new Date() } },
    });
  }

  /** ISO time the user's next card is due, or null if they have no cards. */
  async nextDueAt(userId: string): Promise<string | null> {
    const row = await this.prisma.puzzleReview.findFirst({
      where: { userId },
      orderBy: { dueAt: 'asc' },
      select: { dueAt: true },
    });
    return row ? row.dueAt.toISOString() : null;
  }

  /**
   * Grade a reviewed card and reschedule it. Maps the binary solve outcome to an
   * SM-2 grade — failed → `again`, solved → `good` (or `easy` when solved under
   * {@link EASY_MS_THRESHOLD}) — runs {@link schedule}, and either updates the
   * row with the new state or, once the interval crosses
   * {@link GRADUATION_INTERVAL_DAYS}, deletes the card (it's learned).
   *
   * A grade on a puzzle with no review row (e.g. graded directly without a prior
   * failure) is a no-op success: returns a graduated result without inserting,
   * so the review surface never resurrects a card that isn't queued.
   */
  async grade(
    userId: string,
    puzzleId: string,
    solved: boolean,
    msToSolve?: number,
  ): Promise<ReviewGradeResultDto> {
    const existing = await this.prisma.puzzleReview.findUnique({
      where: { userId_puzzleId: { userId, puzzleId } },
      select: { intervalDays: true, easeFactor: true, reps: true, lapses: true },
    });

    if (!existing) {
      // Nothing queued — treat as already-learned; don't create a card.
      return { puzzleId, graduated: true, nextDueAt: null, intervalDays: 0 };
    }

    // A graded review (solved OR failed) is a completed review action — advance
    // the streak. Best-effort: a streak write never fails the grade. Fires once
    // per real graded card (the no-op early return above is skipped).
    await this.recordStreakActivity(userId, puzzleId);

    const grade = resolveGrade(solved, msToSolve);
    const next = schedule(toCardState(existing), grade);

    // Graduate: a learned card leaves the queue entirely.
    if (next.intervalDays > GRADUATION_INTERVAL_DAYS) {
      await this.prisma.puzzleReview.delete({
        where: { userId_puzzleId: { userId, puzzleId } },
      });
      this.logger.log(
        `review graduated: user ${userId} puzzle ${puzzleId} (interval ${next.intervalDays}d > ${GRADUATION_INTERVAL_DAYS}d)`,
      );
      return { puzzleId, graduated: true, nextDueAt: null, intervalDays: next.intervalDays };
    }

    const dueAt = offsetDays(next.nextDueOffsetDays);
    await this.prisma.puzzleReview.update({
      where: { userId_puzzleId: { userId, puzzleId } },
      data: {
        dueAt,
        intervalDays: next.intervalDays,
        easeFactor: next.easeFactor,
        reps: next.reps,
        lapses: next.lapses,
      },
    });

    return {
      puzzleId,
      graduated: false,
      nextDueAt: dueAt.toISOString(),
      intervalDays: next.intervalDays,
    };
  }

  /** Best-effort streak bump for a completed review (never throws). */
  private async recordStreakActivity(userId: string, puzzleId: string): Promise<void> {
    if (!this.streakService) return;
    try {
      await this.streakService.recordActivity(userId, 'review');
    } catch (err) {
      this.logger.warn(
        `streak recordActivity failed for user ${userId} review ${puzzleId}: ${String(err)}`,
      );
    }
  }

  /** Assemble the full due-queue payload for the client. */
  async getDuePayload(userId: string, limit = DEFAULT_DUE_LIMIT): Promise<ReviewDueDto> {
    const [puzzles, count] = await Promise.all([
      this.getDue(userId, limit),
      this.dueCount(userId),
    ]);
    const nextDueAt = count === 0 ? await this.nextDueAt(userId) : null;
    return { puzzles, dueCount: count, nextDueAt };
  }
}

/** Binary outcome → SM-2 grade. Fast solves are graded `easy`. */
function resolveGrade(solved: boolean, msToSolve?: number): ReviewGrade {
  if (!solved) return 'again';
  if (typeof msToSolve === 'number' && msToSolve > 0 && msToSolve < EASY_MS_THRESHOLD) {
    return 'easy';
  }
  return 'good';
}

/** Maps a Prisma Puzzle row to the public `PuzzleDto`. */
function toPuzzleDto(p: {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  ratingDeviation: number;
  popularity: number;
  plays: number;
  themes: string[];
  openingTags: string[];
}): PuzzleDto {
  return {
    id: p.id,
    fen: p.fen,
    moves: p.moves,
    rating: p.rating,
    ratingDeviation: p.ratingDeviation,
    popularity: p.popularity,
    plays: p.plays,
    themes: p.themes,
    openingTags: p.openingTags,
  };
}

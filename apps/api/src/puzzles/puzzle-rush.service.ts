import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type Redis from 'ioredis';
import type { PuzzleDto, RushMode } from '@purechess/shared';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { PuzzleRatingService } from './puzzle-rating.service';

/** Default target rating for a user who has never solved a puzzle. */
const DEFAULT_TARGET_RATING = 1500;

/** Number of puzzles in a rush set. */
const SET_SIZE = 40;

/**
 * The set starts this far BELOW the user's rating (early gimmes) and climbs to
 * this far ABOVE it (the wall). Band tier i samples [start + i*step, …].
 */
const START_BELOW = 200;
const END_ABOVE = 400;

/** Per-band sampling window half-width (puzzles near each rung's target). */
const BAND_HALF = 90;

/** How long a cached rush set lives in Redis (a run can't outlast this). */
const SET_TTL_SECONDS = 60 * 30; // 30 min — generous; a run is ~3 min.

/** Redis key for a user's personal best per mode (a small hash). */
function pbKey(userId: string): string {
  return `puzzle:rush:pb:${userId}`;
}

/** Redis key for a cached run set. */
function setKey(runId: string): string {
  return `puzzle:rush:set:${runId}`;
}

/** A row from the raw selection query (only the columns `PuzzleDto` needs). */
interface PuzzleRow {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  ratingDeviation: number;
  popularity: number;
  plays: number;
  themes: string[];
  openingTags: string[];
}

/**
 * Puzzle Rush — the timed board-vision drill. The single best exercise against
 * hanging pieces: solve as many escalating-difficulty puzzles as you can before
 * the clock runs out (3min) or you miss five (5strikes).
 *
 * `buildSet` assembles ~40 puzzles whose ratings ramp from ~200 below the
 * user's puzzle rating to past it, so early puzzles are gimmes and the run gets
 * progressively harder. It reuses the same rating-window selection strategy as
 * {@link PuzzleServingService} (composable, parameterized `Prisma.sql`), but
 * walks a ladder of rating bands and de-duplicates across the whole set.
 *
 * PB STORAGE — the schema is FROZEN (no `PuzzleRun` table). A run's only
 * durable artifact is the per-mode personal best, stored server-side in a Redis
 * hash (`puzzle:rush:pb:<userId>` → `{ '3min': N, '5strikes': M }`). This is
 * deliberately lightweight: rush is for fast reps, not a permanent ledger, and
 * each solved puzzle ALSO records a normal `PuzzleAttempt` (source `'rush'`) via
 * the client, so it still feeds the durable puzzle rating + theme stats. If a
 * persistent per-run history is ever wanted (leaderboards, run-by-run charts),
 * add a `PuzzleRun` table via an S01 schema amendment — flagged in the handoff.
 */
@Injectable()
export class PuzzleRushService {
  private readonly logger = new Logger(PuzzleRushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ratingService: PuzzleRatingService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Assembles an escalating-difficulty set of {@link SET_SIZE} puzzles and
   * caches it under a new run id. The first puzzles sit ~{@link START_BELOW}
   * below the user's puzzle rating; the last ~{@link END_ABOVE} above it. No
   * puzzle repeats within a set. Returns `{ runId, puzzles }`.
   */
  async buildSet(
    userId: string,
    mode: RushMode = '3min',
  ): Promise<{ runId: string; puzzles: PuzzleDto[] }> {
    const base = await this.resolveTargetRating(userId);
    const lo = base - START_BELOW;
    const hi = base + END_ABOVE;
    const step = (hi - lo) / (SET_SIZE - 1);

    const picked: PuzzleRow[] = [];
    const seen = new Set<string>();

    // Walk the ramp rung by rung, pulling the closest unused puzzle to each
    // rung's target rating. Pulling a small candidate pool per rung and
    // skipping already-picked ids keeps the set free of intra-set duplicates
    // while staying close to the intended difficulty curve.
    for (let i = 0; i < SET_SIZE; i++) {
      const target = Math.round(lo + step * i);
      const row = await this.pickNear(target, seen);
      if (!row) continue;
      seen.add(row.id);
      picked.push(row);
    }

    // Defensive backfill: if narrow bands left the set short (sparse bank),
    // pull any remaining puzzles ordered by closeness to the midpoint so the
    // run still has length. Still de-duped.
    if (picked.length < SET_SIZE) {
      const fill = await this.pickFill(base, seen, SET_SIZE - picked.length);
      for (const row of fill) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        picked.push(row);
      }
    }

    // Sort the assembled set by rating ascending so difficulty escalates
    // cleanly end-to-end regardless of which rung (or the backfill) sourced
    // each row. The ramp is the whole point — early gimmes, a hard finish.
    picked.sort((a, b) => a.rating - b.rating);

    const puzzles = picked.map(toPuzzleDto);
    const runId = randomUUID();
    await this.redis.set(
      setKey(runId),
      JSON.stringify({ userId, mode, puzzles }),
      'EX',
      SET_TTL_SECONDS,
    );
    this.logger.log(
      `buildSet: ${puzzles.length} puzzles for user ${userId} (mode ${mode}, base ${base}, ${lo}→${hi})`,
    );
    return { runId, puzzles };
  }

  /**
   * Records a finished run's score against the user's per-mode personal best
   * (Redis hash). Returns the best after this run and whether it was a PB.
   * Negative scores are clamped to 0.
   */
  async recordRun(
    userId: string,
    input: { mode?: RushMode; score: number; durationMs?: number },
  ): Promise<{ best: number; isPB: boolean }> {
    const mode: RushMode = input.mode ?? '3min';
    const score = Math.max(0, Math.floor(Number(input.score) || 0));

    const prevRaw = await this.redis.hget(pbKey(userId), mode);
    const prev = prevRaw != null ? Number(prevRaw) : 0;
    const isPB = score > prev;
    const best = isPB ? score : prev;

    if (isPB) {
      await this.redis.hset(pbKey(userId), mode, String(best));
    }

    this.logger.log(
      `recordRun: user ${userId} mode ${mode} score ${score} (prev ${prev}, best ${best}${isPB ? ', NEW PB' : ''}, ${input.durationMs ?? '?'}ms)`,
    );
    return { best, isPB };
  }

  /** The user's personal best per mode (0 when unset). */
  async getPersonalBests(userId: string): Promise<{ '3min': number; '5strikes': number }> {
    const map = await this.redis.hgetall(pbKey(userId));
    return {
      '3min': map['3min'] != null ? Number(map['3min']) : 0,
      '5strikes': map['5strikes'] != null ? Number(map['5strikes']) : 0,
    };
  }

  /** Target rating: user's puzzle rating → default 1500. */
  private async resolveTargetRating(userId: string): Promise<number> {
    const snap = await this.ratingService.get(userId);
    const r = snap?.rating;
    return Math.round(typeof r === 'number' && Number.isFinite(r) ? r : DEFAULT_TARGET_RATING);
  }

  /**
   * The puzzle nearest `target` rating not already in `exclude`, within a band
   * around it. Built from composable `Prisma.sql` so the WHERE is fully
   * parameterized. Orders by distance to the target, breaks ties randomly, so
   * adjacent rungs don't always return the same row.
   */
  private async pickNear(target: number, exclude: Set<string>): Promise<PuzzleRow | null> {
    const conds: Prisma.Sql[] = [
      Prisma.sql`p.rating BETWEEN ${target - BAND_HALF} AND ${target + BAND_HALF}`,
    ];
    if (exclude.size > 0) {
      conds.push(Prisma.sql`p.id NOT IN (${Prisma.join([...exclude])})`);
    }
    const where = Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}`;

    const rows = await this.prisma.$queryRaw<PuzzleRow[]>(Prisma.sql`
      SELECT p.id, p.fen, p.moves, p.rating, p."ratingDeviation",
             p.popularity, p.plays, p.themes, p."openingTags"
      FROM "Puzzle" p
      ${where}
      ORDER BY abs(p.rating - ${target}) ASC, random()
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  /**
   * Backfill rows nearest the base rating, excluding already-picked ids. Used
   * only when the per-rung bands left the set short on a sparse bank.
   */
  private async pickFill(base: number, exclude: Set<string>, limit: number): Promise<PuzzleRow[]> {
    const conds: Prisma.Sql[] = [];
    if (exclude.size > 0) {
      conds.push(Prisma.sql`p.id NOT IN (${Prisma.join([...exclude])})`);
    }
    const where =
      conds.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty;

    return this.prisma.$queryRaw<PuzzleRow[]>(Prisma.sql`
      SELECT p.id, p.fen, p.moves, p.rating, p."ratingDeviation",
             p.popularity, p.plays, p.themes, p."openingTags"
      FROM "Puzzle" p
      ${where}
      ORDER BY abs(p.rating - ${base}) ASC
      LIMIT ${limit}
    `);
  }
}

/** Maps a raw selection row to the public `PuzzleDto`. */
function toPuzzleDto(row: PuzzleRow): PuzzleDto {
  return {
    id: row.id,
    fen: row.fen,
    moves: row.moves,
    rating: row.rating,
    ratingDeviation: row.ratingDeviation,
    popularity: row.popularity,
    plays: row.plays,
    themes: row.themes,
    openingTags: row.openingTags,
  };
}

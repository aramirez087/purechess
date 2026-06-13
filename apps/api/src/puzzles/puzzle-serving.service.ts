import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PuzzleAttemptResultDto,
  PuzzleDto,
  PuzzleSource,
  PuzzleThemeStatDto,
} from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import { PuzzleRatingService } from './puzzle-rating.service';

/** Default target rating for a user who has never solved a puzzle. */
const DEFAULT_TARGET_RATING = 1500;

/** Window half-widths tried in order; the last (null) drops the rating filter. */
const RATING_WINDOWS = [150, 300, 600] as const;

/** Cap on recent attempts pulled for the per-theme stats roll-up. */
const STATS_ATTEMPT_CAP = 1000;

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
 * Serves the right puzzle to the right user at the right difficulty, records
 * every attempt, drives the per-user puzzle Glicko, and rolls up per-theme
 * accuracy. This is the engine the whole Improve surface runs on.
 *
 * Selection uses a parameterized `$queryRaw` (not the Prisma query builder)
 * because we need three things Prisma can't express cleanly together: a
 * `themes @> ARRAY[$theme]` GIN containment, a NOT-IN subquery against the
 * user's prior attempts, and `ORDER BY random() LIMIT 1`. The query is fully
 * parameterized — no string interpolation of user input.
 */
@Injectable()
export class PuzzleServingService {
  private readonly logger = new Logger(PuzzleServingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ratingService: PuzzleRatingService,
  ) {}

  /**
   * Returns one unseen puzzle in the user's rating window. Resolution order for
   * the target rating: explicit `rating` arg → the user's PuzzleRating.rating →
   * {@link DEFAULT_TARGET_RATING}. The window starts at ±150 and widens through
   * a fallback ladder (±300, ±600, then drop both the rating *and* unseen
   * filters) until a puzzle is found; the firing tier is logged.
   */
  async getNext(
    userId: string,
    opts: { theme?: string; rating?: number } = {},
  ): Promise<PuzzleDto> {
    const target = await this.resolveTargetRating(userId, opts.rating);
    const theme = opts.theme?.trim() || undefined;

    // Tiers 0..2: progressively wider rating window, still excluding seen ids.
    for (let tier = 0; tier < RATING_WINDOWS.length; tier++) {
      const half = RATING_WINDOWS[tier];
      const row = await this.pickOne(userId, {
        min: target - half,
        max: target + half,
        theme,
        excludeSeen: true,
      });
      if (row) {
        if (tier > 0) {
          this.logger.log(
            `getNext fallback: tier ${tier} (±${half}) fired for user ${userId} (target ${target}${theme ? `, theme ${theme}` : ''})`,
          );
        }
        return toPuzzleDto(row);
      }
    }

    // Final tier: drop the unseen filter and the rating window entirely. The
    // user has exhausted the band; better to re-serve a solved puzzle than 404.
    this.logger.log(
      `getNext fallback: final tier (drop unseen + rating window) fired for user ${userId}${theme ? ` (theme ${theme})` : ''}`,
    );
    const last = await this.pickOne(userId, { theme, excludeSeen: false });
    if (last) return toPuzzleDto(last);

    throw new NotFoundException(
      theme ? `no puzzles available for theme "${theme}"` : 'no puzzles available',
    );
  }

  /**
   * Records an attempt: inserts a `PuzzleAttempt` (capturing the user's puzzle
   * rating before), updates the puzzle Glicko via {@link PuzzleRatingService},
   * stamps the after-rating back onto the row, increments `Puzzle.plays`, and
   * returns the rating delta so the client can show the move.
   */
  async recordAttempt(
    userId: string,
    puzzleId: string,
    input: { solved: boolean; msToSolve?: number; source?: PuzzleSource },
  ): Promise<PuzzleAttemptResultDto> {
    const puzzle = await this.prisma.puzzle.findUnique({
      where: { id: puzzleId },
      select: { id: true, rating: true, ratingDeviation: true },
    });
    if (!puzzle) throw new NotFoundException(`puzzle ${puzzleId} not found`);

    const before = await this.ratingService.get(userId);
    const ratingBeforeUser = Math.round(before.rating);

    const after = await this.ratingService.applyResult(
      userId,
      puzzle.rating,
      puzzle.ratingDeviation,
      input.solved,
    );
    const ratingAfterUser = Math.round(after.rating);

    await this.prisma.puzzleAttempt.create({
      data: {
        userId,
        puzzleId,
        solved: input.solved,
        msToSolve: input.msToSolve ?? null,
        ratingBeforeUser,
        ratingAfterUser,
        source: input.source ?? 'theme',
      },
    });

    await this.prisma.puzzle.update({
      where: { id: puzzleId },
      data: { plays: { increment: 1 } },
    });

    return {
      puzzleId,
      solved: input.solved,
      ratingBefore: ratingBeforeUser,
      ratingAfter: ratingAfterUser,
      ratingDelta: ratingAfterUser - ratingBeforeUser,
    };
  }

  /**
   * Per-theme accuracy for the user's recent attempts (capped at
   * {@link STATS_ATTEMPT_CAP}). An attempt counts toward *every* theme its
   * puzzle lists. Sorted accuracy ASC — weakest first — because "what to drill"
   * is the product signal; keep this ordering.
   */
  async getStats(userId: string): Promise<PuzzleThemeStatDto[]> {
    const attempts = await this.prisma.puzzleAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: STATS_ATTEMPT_CAP,
      select: {
        solved: true,
        msToSolve: true,
        createdAt: true,
        puzzle: { select: { themes: true } },
      },
    });

    interface Acc {
      attempts: number;
      solved: number;
      msSum: number;
      msCount: number;
      lastAttemptedAt: Date;
    }
    const byTheme = new Map<string, Acc>();

    for (const a of attempts) {
      for (const slug of a.puzzle.themes) {
        let acc = byTheme.get(slug);
        if (!acc) {
          acc = { attempts: 0, solved: 0, msSum: 0, msCount: 0, lastAttemptedAt: a.createdAt };
          byTheme.set(slug, acc);
        }
        acc.attempts += 1;
        if (a.solved) acc.solved += 1;
        if (a.msToSolve != null) {
          acc.msSum += a.msToSolve;
          acc.msCount += 1;
        }
        if (a.createdAt > acc.lastAttemptedAt) acc.lastAttemptedAt = a.createdAt;
      }
    }

    const stats: PuzzleThemeStatDto[] = [...byTheme.entries()].map(([slug, acc]) => ({
      slug,
      attempts: acc.attempts,
      solved: acc.solved,
      accuracy: acc.attempts > 0 ? acc.solved / acc.attempts : undefined,
      avgMsToSolve: acc.msCount > 0 ? Math.round(acc.msSum / acc.msCount) : undefined,
      lastAttemptedAt: acc.lastAttemptedAt.toISOString(),
    }));

    // Weakest first: lowest accuracy leads. Tie-break by larger sample (more
    // confident the weakness is real), then slug for determinism.
    stats.sort((x, y) => {
      const ax = x.accuracy ?? 0;
      const ay = y.accuracy ?? 0;
      if (ax !== ay) return ax - ay;
      if (x.attempts !== y.attempts) return y.attempts - x.attempts;
      return x.slug.localeCompare(y.slug);
    });

    return stats;
  }

  /** Target rating: explicit arg → user's puzzle rating → default 1500. */
  private async resolveTargetRating(userId: string, explicit?: number): Promise<number> {
    if (typeof explicit === 'number' && Number.isFinite(explicit)) {
      return Math.round(explicit);
    }
    const row = await this.prisma.puzzleRating.findUnique({ where: { userId } });
    return Math.round(row?.rating ?? DEFAULT_TARGET_RATING);
  }

  /**
   * Single random puzzle matching the filters, or null if the band is empty.
   * Built from composable `Prisma.sql` fragments so the WHERE clause is fully
   * parameterized regardless of which filters are active.
   */
  private async pickOne(
    userId: string,
    filters: { min?: number; max?: number; theme?: string; excludeSeen: boolean },
  ): Promise<PuzzleRow | null> {
    const conds: Prisma.Sql[] = [];

    if (filters.min != null && filters.max != null) {
      conds.push(Prisma.sql`p.rating BETWEEN ${filters.min} AND ${filters.max}`);
    }
    if (filters.theme) {
      conds.push(Prisma.sql`p.themes @> ARRAY[${filters.theme}]::text[]`);
    }
    if (filters.excludeSeen) {
      conds.push(
        Prisma.sql`NOT EXISTS (
          SELECT 1 FROM "PuzzleAttempt" a
          WHERE a."puzzleId" = p.id AND a."userId" = ${userId}
        )`,
      );
    }

    const where =
      conds.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty;

    const rows = await this.prisma.$queryRaw<PuzzleRow[]>(Prisma.sql`
      SELECT p.id, p.fen, p.moves, p.rating, p."ratingDeviation",
             p.popularity, p.plays, p.themes, p."openingTags"
      FROM "Puzzle" p
      ${where}
      ORDER BY random()
      LIMIT 1
    `);

    return rows[0] ?? null;
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

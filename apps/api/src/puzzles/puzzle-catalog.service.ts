import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';

/** One theme slug and how many puzzles in the bank carry it. */
export interface PuzzleThemeCount {
  theme: string;
  count: number;
}

/** Min/max puzzle rating across the whole bank (for empty-state / slider UX). */
export interface PuzzleRatingRange {
  min: number;
  max: number;
}

const THEMES_CACHE_KEY = 'puzzle:catalog:themes';
const THEMES_TTL_SECONDS = 60 * 60; // 1h — the bank changes only on a re-seed.

/**
 * Read-only lookups over the seeded `Puzzle` bank: the distinct theme histogram,
 * the total count, and the rating range. These power the Train surface's
 * empty-state and theme picker. The daily-puzzle service (`PuzzlesService`) is
 * untouched — this is an additive sibling provider.
 */
@Injectable()
export class PuzzleCatalogService {
  private readonly logger = new Logger(PuzzleCatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Distinct themes with their puzzle counts, ordered most-common first.
   *
   * `Puzzle.themes` is a `String[]`, so we `unnest` it and GROUP BY in a raw
   * query — at 50k rows this is a cheap full aggregate (no per-theme index
   * helps a GROUP-BY-everything), and the result is small + stable, so we cache
   * it in Redis for 1h. A re-seed is infrequent and the runbook notes the cache
   * self-heals within the hour (or flush `puzzle:catalog:themes` to refresh now).
   */
  async listThemes(): Promise<PuzzleThemeCount[]> {
    const cached = await this.redis.get(THEMES_CACHE_KEY);
    if (cached) return JSON.parse(cached) as PuzzleThemeCount[];

    // count() comes back as a bigint from Postgres; coerce to number.
    const rows = await this.prisma.$queryRaw<{ theme: string; count: bigint }[]>`
      SELECT unnest(themes) AS theme, count(*) AS count
      FROM "Puzzle"
      GROUP BY theme
      ORDER BY count DESC, theme ASC
    `;
    const result: PuzzleThemeCount[] = rows.map((r) => ({
      theme: r.theme,
      count: Number(r.count),
    }));

    await this.redis.setex(THEMES_CACHE_KEY, THEMES_TTL_SECONDS, JSON.stringify(result));
    return result;
  }

  /** Total number of puzzles in the bank. */
  count(): Promise<number> {
    return this.prisma.puzzle.count();
  }

  /**
   * Rating range across the bank. Returns `{ min: 0, max: 0 }` for an empty
   * bank so callers never deref null.
   */
  async ratingRange(): Promise<PuzzleRatingRange> {
    const agg = await this.prisma.puzzle.aggregate({
      _min: { rating: true },
      _max: { rating: true },
    });
    return { min: agg._min.rating ?? 0, max: agg._max.rating ?? 0 };
  }
}

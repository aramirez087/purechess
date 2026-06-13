import { Injectable } from '@nestjs/common';
import type { PuzzleRatingDto } from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import { updateRating, type GlickoRating } from '../ratings/glicko2';

/** New-puzzle-solver defaults, matching the schema column defaults. */
const DEFAULT_PUZZLE_RATING = { rating: 1500, deviation: 350, volatility: 0.06 };

/**
 * Per-user puzzle Glicko-2 rating. A solved/failed puzzle is modeled as one
 * Glicko-2 "game" against an opponent whose rating/deviation are the puzzle's
 * own (`Puzzle.rating` / `Puzzle.ratingDeviation`), score = 1 if solved else 0.
 *
 * The rating math is the EXISTING, paper-exact `updateRating` from
 * `apps/api/src/ratings/glicko2.ts` — reused verbatim, never reimplemented, so
 * game ratings and puzzle ratings share one provably-correct engine. We keep
 * the unrounded Float values (the `PuzzleRating` columns are Float, unlike the
 * Int game `Rating`) so deviation/volatility don't drift under repeated updates.
 */
@Injectable()
export class PuzzleRatingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Applies one puzzle outcome to the user's puzzle rating and upserts it.
   * `puzzleRating` / `ratingDeviation` describe the puzzle (the opponent).
   * Returns the new Glicko snapshot (unrounded).
   */
  async applyResult(
    userId: string,
    puzzleRating: number,
    ratingDeviation: number,
    solved: boolean,
  ): Promise<{ rating: number; deviation: number; volatility: number }> {
    const existing = await this.prisma.puzzleRating.findUnique({ where: { userId } });
    const player: GlickoRating = existing
      ? {
          rating: existing.rating,
          ratingDeviation: existing.deviation,
          volatility: existing.volatility,
        }
      : {
          rating: DEFAULT_PUZZLE_RATING.rating,
          ratingDeviation: DEFAULT_PUZZLE_RATING.deviation,
          volatility: DEFAULT_PUZZLE_RATING.volatility,
        };

    const opponent: GlickoRating = {
      rating: puzzleRating,
      // Puzzle.ratingDeviation defaults can be 0 on a sparse seed; clamp to a
      // sane floor so a zero-RD opponent doesn't collapse the variance term.
      ratingDeviation: ratingDeviation > 0 ? ratingDeviation : 60,
      volatility: DEFAULT_PUZZLE_RATING.volatility,
    };

    const next = updateRating(player, [{ opponent, score: solved ? 1 : 0 }]);
    const result = {
      rating: next.rating,
      deviation: next.ratingDeviation,
      volatility: next.volatility,
    };

    await this.prisma.puzzleRating.upsert({
      where: { userId },
      update: {
        rating: result.rating,
        deviation: result.deviation,
        volatility: result.volatility,
      },
      create: {
        userId,
        rating: result.rating,
        deviation: result.deviation,
        volatility: result.volatility,
      },
    });

    return result;
  }

  /** The user's current puzzle rating snapshot, or the defaults if unrated. */
  async get(userId: string): Promise<PuzzleRatingDto> {
    const row = await this.prisma.puzzleRating.findUnique({ where: { userId } });
    if (!row) {
      return {
        rating: DEFAULT_PUZZLE_RATING.rating,
        deviation: DEFAULT_PUZZLE_RATING.deviation,
        volatility: DEFAULT_PUZZLE_RATING.volatility,
      };
    }
    return {
      rating: row.rating,
      deviation: row.deviation,
      volatility: row.volatility,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

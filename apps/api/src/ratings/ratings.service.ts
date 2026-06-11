import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { TimeControlCategory } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DEFAULT_RATING, updateRating, type GlickoRating } from './glicko2';

/**
 * Glicko-2 rating processing. Runs once per completed rated PvP game;
 * idempotency is enforced by the `whiteRatingAfter IS NULL` guard inside the
 * transaction, so concurrent callers (both players' finalize paths) can race
 * safely — exactly one wins.
 */
@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async processGameResult(gameId: string): Promise<void> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (
      !game ||
      game.status !== 'completed' ||
      !game.isRated ||
      game.isVsComputer ||
      !game.whiteUserId ||
      !game.blackUserId ||
      !game.result
    ) {
      return;
    }
    if (game.whiteRatingAfter !== null) return; // already processed

    const whiteScore = (
      game.result === 'white_wins' ? 1 : game.result === 'black_wins' ? 0 : 0.5
    ) as 0 | 0.5 | 1;
    const blackScore = (1 - whiteScore) as 0 | 0.5 | 1;

    // Ensure both rows exist before the transaction (idempotent upserts).
    const [whiteRow, blackRow] = await Promise.all([
      this.getOrCreateRating(game.whiteUserId, game.category),
      this.getOrCreateRating(game.blackUserId, game.category),
    ]);

    let summary = '';
    try {
      await this.prisma.$transaction(async (tx) => {
        // Per-game idempotency gate: first writer wins, racers roll back.
        // (Snapshot values are written after the locked re-read below.)
        const claimed = await tx.game.updateMany({
          where: { id: gameId, whiteRatingAfter: null },
          data: { whiteRatingAfter: 0 },
        });
        if (claimed.count === 0) throw new AlreadyProcessedError();

        // Lock both rating rows (ordered, to avoid deadlocks) and re-read
        // inside the transaction: two different games sharing a player would
        // otherwise both compute from the same stale base and the second
        // commit would silently erase the first game's rating effect.
        const ids = [whiteRow.id, blackRow.id].sort();
        await tx.$queryRaw`SELECT id FROM "Rating" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
        const [white, black] = await Promise.all([
          tx.rating.findUniqueOrThrow({ where: { id: whiteRow.id } }),
          tx.rating.findUniqueOrThrow({ where: { id: blackRow.id } }),
        ]);

        const whiteNext = updateRating(toGlicko(white), [
          { opponent: toGlicko(black), score: whiteScore },
        ]);
        const blackNext = updateRating(toGlicko(black), [
          { opponent: toGlicko(white), score: blackScore },
        ]);

        await tx.game.update({
          where: { id: gameId },
          data: {
            whiteRatingBefore: white.rating,
            whiteRatingAfter: Math.round(whiteNext.rating),
            blackRatingBefore: black.rating,
            blackRatingAfter: Math.round(blackNext.rating),
          },
        });
        await this.persistRating(tx, white.id, whiteNext);
        await this.persistRating(tx, black.id, blackNext);
        await tx.ratingHistory.create({
          data: {
            userId: game.whiteUserId!,
            category: game.category,
            ratingBefore: white.rating,
            ratingAfter: Math.round(whiteNext.rating),
            ratingDelta: Math.round(whiteNext.rating) - white.rating,
            gameId,
          },
        });
        await tx.ratingHistory.create({
          data: {
            userId: game.blackUserId!,
            category: game.category,
            ratingBefore: black.rating,
            ratingAfter: Math.round(blackNext.rating),
            ratingDelta: Math.round(blackNext.rating) - black.rating,
            gameId,
          },
        });
        summary = `white ${white.rating} -> ${Math.round(whiteNext.rating)}, black ${black.rating} -> ${Math.round(blackNext.rating)}`;
      });
    } catch (err) {
      if (err instanceof AlreadyProcessedError) return;
      throw err;
    }

    this.logger.log(`Rated game ${gameId}: ${summary} (${game.category})`);
  }

  private async getOrCreateRating(userId: string, category: TimeControlCategory) {
    return this.prisma.rating.upsert({
      where: { userId_category: { userId, category } },
      update: {},
      create: {
        userId,
        category,
        rating: DEFAULT_RATING.rating,
        ratingDeviation: DEFAULT_RATING.ratingDeviation,
        volatility: DEFAULT_RATING.volatility,
      },
    });
  }

  private persistRating(
    tx: { rating: PrismaService['rating'] },
    ratingId: string,
    next: GlickoRating,
  ) {
    return tx.rating.update({
      where: { id: ratingId },
      data: {
        rating: Math.round(next.rating),
        ratingDeviation: Math.round(next.ratingDeviation),
        volatility: next.volatility,
        gamesPlayed: { increment: 1 },
      },
    });
  }
}

class AlreadyProcessedError extends Error {
  constructor() {
    super('rating already processed');
  }
}

function toGlicko(row: {
  rating: number;
  ratingDeviation: number;
  volatility: number;
}): GlickoRating {
  return {
    rating: row.rating,
    ratingDeviation: row.ratingDeviation,
    volatility: row.volatility,
  };
}

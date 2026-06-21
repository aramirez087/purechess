import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import type { InsightDto, WeaknessDto } from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import { PuzzleServingService } from '../puzzles/puzzle-serving.service';
import { GameMistakeService } from '../puzzles/game-mistake.service';
import { EndgamesService } from '../endgames/endgames.service';
import { RepertoireReviewService } from '../repertoire/repertoire-review.service';
import { ChessComService } from '../chess-com/chess-com.service';
import {
  chessComOpeningWeakness,
  endgameGap,
  openingLeak,
  pickStrongerOpeningWeakness,
  recurringGameMistake,
  tacticalThemeWeakness,
  timeManagement,
  type ChessComMistakeSummary,
  type EndgameCategoryStat,
  type MistakeCluster,
  type MoveTimeAgg,
  type RepertoireOutcome,
  type ThemeStat,
} from './weakness-detectors';

/** Cap on weaknesses returned (the card list stays short + scannable). */
export const MAX_INSIGHTS = 5;

/** Redis cache TTL for a user's computed insights (seconds). Heavy read; 15 min. */
export const INSIGHTS_CACHE_TTL_SECONDS = 15 * 60;

/** How many of the user's recent games to scan for the time-management aggregate. */
const TIME_GAMES_SCANNED = 30;

/** A move blunders if it cost at least this many centipawns — mirrors the mistake band. */
const BLUNDER_CP = 150;

/** How many recent game-mistakes to cluster for the recurring-mistake detector. */
const MISTAKE_SCAN_LIMIT = 100;

function cacheKey(userId: string): string {
  return `insights:${userId}`;
}

/**
 * The insights engine: a READ-ONLY miner over the existing training signals.
 * Gathers per-domain aggregates (reusing the existing services + a few read-only
 * Prisma aggregates), runs every pure detector, ranks the surviving weaknesses
 * by `severity × impact`, dedupes by domain, and returns the top
 * {@link MAX_INSIGHTS}. The result is cached per user in Redis for
 * {@link INSIGHTS_CACHE_TTL_SECONDS} because the aggregation is heavier than a
 * normal request.
 *
 * Nothing here is authoritative — it only reads. The detectors do the reasoning;
 * this service only feeds them and orders the output.
 */
@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly serving: PuzzleServingService,
    private readonly mistakes: GameMistakeService,
    private readonly endgames: EndgamesService,
    private readonly repertoireReview: RepertoireReviewService,
    private readonly chessCom: ChessComService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * The user's ranked weakness list. Served from the Redis cache when warm,
   * otherwise computed and cached. `force` bypasses the cache (used after a
   * burst of activity, if a caller ever wants a fresh read).
   */
  async getInsights(userId: string, force = false): Promise<InsightDto> {
    if (!force) {
      const cached = await this.readCache(userId);
      if (cached) return cached;
    }
    const insight = await this.compute(userId);
    await this.writeCache(userId, insight);
    return insight;
  }

  /** Compute (no cache) — gather aggregates, run detectors, rank, dedupe, cap. */
  async compute(userId: string): Promise<InsightDto> {
    const [themeStats, clusters, openingOutcomes, chessComMistakes, endgameStats, moveAgg] =
      await Promise.all([
        this.gatherThemeStats(userId),
        this.gatherMistakeClusters(userId),
        this.gatherOpeningOutcomes(userId),
        this.gatherChessComMistakes(userId),
        this.gatherEndgameStats(userId),
        this.gatherMoveTimeAgg(userId),
      ]);

    const openingWeakness = pickStrongerOpeningWeakness(
      openingLeak(openingOutcomes),
      chessComOpeningWeakness(chessComMistakes),
    );

    const candidates: (WeaknessDto | null)[] = [
      tacticalThemeWeakness(themeStats),
      recurringGameMistake(clusters),
      openingWeakness,
      endgameGap(endgameStats),
      timeManagement(moveAgg),
    ];

    const weaknesses = rankWeaknesses(candidates).slice(0, MAX_INSIGHTS);

    return {
      generatedAt: new Date().toISOString(),
      headline: weaknesses[0]?.title,
      weaknesses,
    };
  }

  // --- aggregate gatherers (each reuses an existing service where it can) ----

  /** Per-theme puzzle accuracy via the existing serving roll-up. */
  private async gatherThemeStats(userId: string): Promise<ThemeStat[]> {
    const stats = await this.serving.getStats(userId);
    return stats.map((s) => ({
      slug: s.slug,
      label: s.label,
      attempts: s.attempts,
      accuracy: s.accuracy,
    }));
  }

  /**
   * Cluster the user's recent game-mistakes by `themeGuess`. Each mistake may
   * carry several theme guesses; every guess contributes to its cluster. Themes
   * with no guess (the field is optional) simply don't form a cluster.
   */
  private async gatherMistakeClusters(userId: string): Promise<MistakeCluster[]> {
    const mistakes = await this.mistakes.listMistakes(userId);
    const recent = mistakes.slice(0, MISTAKE_SCAN_LIMIT);
    const byTheme = new Map<string, number>();
    for (const m of recent) {
      for (const theme of m.themeGuess ?? []) {
        byTheme.set(theme, (byTheme.get(theme) ?? 0) + 1);
      }
    }
    const total = recent.length;
    return [...byTheme.entries()].map(([theme, count]) => ({
      theme,
      count,
      totalMistakes: total,
    }));
  }

  /**
   * The user's most-lapsed repertoire lines. Reads `RepertoireReview` rows
   * (ordered by lapses) joined to their repertoire for a human label. Read-only
   * — no drill state is mutated. The line label is the repertoire name plus the
   * leaf path (the precise line resolution lives in the opening trainer).
   */
  /** chess.com opening mistakes stored after client-side sync. */
  private async gatherChessComMistakes(userId: string): Promise<ChessComMistakeSummary[]> {
    const rows = await this.chessCom.getMistakesForInsights(userId);
    return rows
      .filter((m) => !m.reviewed)
      .map((m) => ({
        openingLabel: m.openingLabel,
        cpLoss: m.cpLoss,
        playedAt: m.playedAt,
        fen: m.fen,
      }));
  }

  private async gatherOpeningOutcomes(userId: string): Promise<RepertoireOutcome[]> {
    const reviews = await this.prisma.repertoireReview.findMany({
      where: { userId, lapses: { gt: 0 } },
      orderBy: { lapses: 'desc' },
      take: 50,
      select: { repertoireId: true, nodePath: true, lapses: true, reps: true },
    });
    if (reviews.length === 0) return [];

    const repIds = [...new Set(reviews.map((r) => r.repertoireId))];
    const reps = await this.prisma.repertoire.findMany({
      where: { id: { in: repIds }, userId },
      select: { id: true, name: true },
    });
    const nameById = new Map(reps.map((r) => [r.id, r.name]));

    return reviews.map((r) => ({
      label: nameById.get(r.repertoireId) ?? 'your repertoire',
      repertoireId: r.repertoireId,
      lapses: r.lapses,
      reps: r.reps,
    }));
  }

  /** Per-category endgame gaps via the existing list roll-up (attempted & !solved). */
  private async gatherEndgameStats(userId: string): Promise<EndgameCategoryStat[]> {
    const drills = await this.endgames.list(userId);
    const byCategory = new Map<string, { unsolved: number; attempted: number }>();
    for (const d of drills) {
      if (!d.attempted) continue;
      const bucket = byCategory.get(d.category) ?? { unsolved: 0, attempted: 0 };
      bucket.attempted += 1;
      if (!d.solved) bucket.unsolved += 1;
      byCategory.set(d.category, bucket);
    }
    return [...byCategory.entries()].map(([category, b]) => ({
      category,
      unsolved: b.unsolved,
      attempted: b.attempted,
    }));
  }

  /**
   * Time-management aggregate over the user's recent games — READ-ONLY. Pulls
   * the user's last {@link TIME_GAMES_SCANNED} completed games, then their own
   * moves, and counts: fast moves (<3s) and how many of those were blunders, the
   * baseline blunder rate over all their moves, and how many decisive games they
   * lost on the clock (flag losses). A "blunder" here uses `Move.moveTimeMs` for
   * speed and the persisted FEN trail is NOT re-evaluated — instead we read the
   * already-captured `GameMistake` rows for cpLoss (the only persisted per-move
   * eval), joining on `(gameId, ply)`. No live engine call.
   */
  private async gatherMoveTimeAgg(userId: string): Promise<MoveTimeAgg> {
    const games = await this.prisma.game.findMany({
      where: {
        status: 'completed',
        OR: [{ whiteUserId: userId }, { blackUserId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: TIME_GAMES_SCANNED,
      select: {
        id: true,
        whiteUserId: true,
        blackUserId: true,
        result: true,
        resultReason: true,
      },
    });

    if (games.length === 0) {
      return {
        fastMoves: 0,
        fastBlunders: 0,
        totalClassifiedMoves: 0,
        totalBlunders: 0,
        decisiveGames: 0,
        flagLosses: 0,
      };
    }

    const gameIds = games.map((g) => g.id);

    // Flag losses: decisive games the user lost via `timeout`.
    let decisiveGames = 0;
    let flagLosses = 0;
    for (const g of games) {
      if (g.result === 'draw' || g.result === null) continue;
      decisiveGames += 1;
      const userIsWhite = g.whiteUserId === userId;
      const userLost =
        (g.result === 'white_wins' && !userIsWhite) ||
        (g.result === 'black_wins' && userIsWhite);
      if (userLost && g.resultReason === 'timeout') flagLosses += 1;
    }

    // The user's own moves across those games (speed signal).
    const moves = await this.prisma.move.findMany({
      where: { gameId: { in: gameIds }, userId },
      select: { gameId: true, ply: true, moveTimeMs: true },
    });

    // Persisted per-move blunders (cpLoss) for the SAME user/games — the only
    // already-computed eval. Keyed by `gameId:ply`.
    const blunderRows = await this.prisma.gameMistake.findMany({
      where: { userId, gameId: { in: gameIds }, cpLoss: { gte: BLUNDER_CP } },
      select: { gameId: true, ply: true },
    });
    const blunderKeys = new Set(blunderRows.map((b) => `${b.gameId}:${b.ply}`));

    let fastMoves = 0;
    let fastBlunders = 0;
    let totalBlunders = 0;
    for (const m of moves) {
      const isBlunder = blunderKeys.has(`${m.gameId}:${m.ply}`);
      if (isBlunder) totalBlunders += 1;
      if (m.moveTimeMs < 3000) {
        fastMoves += 1;
        if (isBlunder) fastBlunders += 1;
      }
    }

    return {
      fastMoves,
      fastBlunders,
      totalClassifiedMoves: moves.length,
      totalBlunders,
      decisiveGames,
      flagLosses,
    };
  }

  // --- cache --------------------------------------------------------------

  private async readCache(userId: string): Promise<InsightDto | null> {
    try {
      const raw = await this.redis.get(cacheKey(userId));
      return raw ? (JSON.parse(raw) as InsightDto) : null;
    } catch (err) {
      this.logger.warn(`insights cache read failed: ${String(err)}`);
      return null;
    }
  }

  private async writeCache(userId: string, insight: InsightDto): Promise<void> {
    try {
      await this.redis.setex(
        cacheKey(userId),
        INSIGHTS_CACHE_TTL_SECONDS,
        JSON.stringify(insight),
      );
    } catch (err) {
      this.logger.warn(`insights cache write failed: ${String(err)}`);
    }
  }
}

/**
 * Rank non-null weaknesses by `severity × impact` (impact = estimatedEloUpside,
 * defaulting to a small constant so an impactless detector still orders by
 * severity). Dedupes by `kind` (keep the strongest per domain) so the list never
 * shows two theme cards. Pure + exported for unit testing the ordering.
 */
export function rankWeaknesses(candidates: (WeaknessDto | null)[]): WeaknessDto[] {
  const present = candidates.filter((w): w is WeaknessDto => w !== null);

  // Dedupe by kind — strongest (severity × impact) wins per domain.
  const byKind = new Map<string, WeaknessDto>();
  for (const w of present) {
    const key = w.kind ?? w.area;
    const existing = byKind.get(key);
    if (!existing || score(w) > score(existing)) byKind.set(key, w);
  }

  return [...byKind.values()].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sb - sa;
    // Tie-break: higher raw severity, then label for determinism.
    if ((b.severity ?? 0) !== (a.severity ?? 0)) {
      return (b.severity ?? 0) - (a.severity ?? 0);
    }
    return a.label.localeCompare(b.label);
  });
}

/** The ranking score: severity × impact. Impact defaults to 10 ELO when absent. */
export function score(w: WeaknessDto): number {
  const severity = w.severity ?? 0;
  const impact = w.estimatedEloUpside ?? 10;
  return severity * impact;
}

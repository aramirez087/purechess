import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { GameResult, GameStatus, TimeControlCategory } from "@prisma/client";
import type { User } from "@prisma/client";
import type {
  GameHistoryResponseDto,
  GameHistorySummaryDto,
  ProfileDto,
  RatingDto,
  RatingHistoryPoint,
  StatsDto,
} from "@purechess/shared";
import { PrismaService } from "../database/prisma.service";
import { PosthogService } from "../analytics/posthog.service";
import { UpdateMeDto } from "./dto/user-profile.dto";
import { GameHistoryQueryDto } from "./dto/game-history.dto";

const RESERVED_USERNAMES = new Set([
  "admin",
  "purechess",
  "system",
  "root",
  "support",
  "help",
  "api",
  "www",
  "mail",
  "info",
  "moderator",
  "mod",
  "staff",
  "bot",
  "null",
  "undefined",
]);

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posthog: PosthogService,
  ) {}

  async getProfile(
    username: string,
    viewerUserId?: string,
  ): Promise<ProfileDto> {
    const user = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      include: { ratings: true },
    });

    if (!user) throw new NotFoundException("User not found");

    if (user.isDisabled) {
      const viewer = viewerUserId
        ? await this.prisma.user.findUnique({
            where: { id: viewerUserId },
            select: { isAdmin: true },
          })
        : null;
      if (!viewer?.isAdmin) throw new NotFoundException("User not found");
    }

    const ratings: RatingDto[] = (
      [
        TimeControlCategory.bullet,
        TimeControlCategory.blitz,
        TimeControlCategory.rapid,
      ] as const
    ).map((cat) => {
      const r = user.ratings.find((x) => x.category === cat);
      return {
        category: cat as "bullet" | "blitz" | "rapid",
        rating: r?.rating ?? 1500,
        gamesPlayed: r?.gamesPlayed ?? 0,
      };
    });

    const stats = await this.computeStats(user.id);

    const recentGames = await this.fetchGames(user.id, user.username, {});

    // Newest 500 entries (~1.5 years of daily play), returned oldest-first
    // for the chart. Ascending take-500 would drop the most recent games.
    const historyRows = await this.prisma.ratingHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        ratingAfter: true,
        ratingDelta: true,
        gameId: true,
        createdAt: true,
        category: true,
      },
    });

    const ratingHistory: RatingHistoryPoint[] = historyRows
      .reverse()
      .map((h) => ({
        ratingAfter: h.ratingAfter,
        ratingDelta: h.ratingDelta,
        gameId: h.gameId,
        playedAt: h.createdAt.toISOString(),
        category: h.category as "bullet" | "blitz" | "rapid",
      }));

    return {
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
      ratings,
      ratingHistory,
      stats,
      recentGames: recentGames.games.slice(0, 10),
    };
  }

  async getGameHistory(
    username: string,
    query: GameHistoryQueryDto,
    viewerUserId?: string,
  ): Promise<GameHistoryResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true, isDisabled: true },
    });

    if (!user) throw new NotFoundException("User not found");

    if (user.isDisabled) {
      const viewer = viewerUserId
        ? await this.prisma.user.findUnique({
            where: { id: viewerUserId },
            select: { isAdmin: true },
          })
        : null;
      if (!viewer?.isAdmin) throw new NotFoundException("User not found");
    }

    return this.fetchGames(user.id, user.username, query);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<User> {
    if (dto.username) {
      if (RESERVED_USERNAMES.has(dto.username.toLowerCase())) {
        throw new BadRequestException("Username is reserved");
      }
      const existing = await this.prisma.user.findFirst({
        where: {
          username: { equals: dto.username, mode: "insensitive" },
          NOT: { id: userId },
        },
      });
      if (existing) throw new ConflictException("Username already taken");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.username !== undefined && { username: dto.username }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });

    this.posthog.captureEvent(userId, "profile_updated", {
      changed_username: dto.username !== undefined,
      changed_avatar: dto.avatarUrl !== undefined,
    });

    return updated;
  }

  private async computeStats(userId: string): Promise<StatsDto> {
    const games = await this.prisma.game.findMany({
      where: {
        OR: [{ whiteUserId: userId }, { blackUserId: userId }],
        status: GameStatus.completed,
      },
      select: { result: true, whiteUserId: true },
    });

    let wins = 0;
    let losses = 0;
    let draws = 0;

    for (const g of games) {
      const playedAsWhite = g.whiteUserId === userId;
      if (g.result === GameResult.draw) {
        draws++;
      } else if (
        (playedAsWhite && g.result === GameResult.white_wins) ||
        (!playedAsWhite && g.result === GameResult.black_wins)
      ) {
        wins++;
      } else if (g.result !== null) {
        losses++;
      }
    }

    const totalGames = wins + losses + draws;
    const winRate =
      totalGames > 0 ? Math.round((wins / totalGames) * 1000) / 10 : 0;

    return { totalGames, wins, losses, draws, winRate };
  }

  private async fetchGames(
    userId: string,
    _username: string,
    query: GameHistoryQueryDto,
  ): Promise<GameHistoryResponseDto> {
    const limit = query.limit ?? 20;

    let cursorCondition: object | undefined;
    if (query.cursor) {
      const cursorGame = await this.prisma.game.findUnique({
        where: { id: query.cursor },
        select: { endedAt: true },
      });
      if (cursorGame?.endedAt) {
        cursorCondition = { endedAt: { lt: cursorGame.endedAt } };
      }
    }

    // Filter conditions only — the cursor is pagination, not a filter, so
    // the total count must not include it.
    const filterWhere = {
      OR: [{ whiteUserId: userId }, { blackUserId: userId }],
      status: GameStatus.completed,
      ...(query.category && { category: query.category }),
      ...(query.isRated !== undefined && { isRated: query.isRated }),
      ...(query.isVsComputer !== undefined && {
        isVsComputer: query.isVsComputer,
      }),
    };

    const [games, total] = await Promise.all([
      this.prisma.game.findMany({
        where: { ...filterWhere, ...cursorCondition },
        include: {
          whitePlayer: { select: { username: true } },
          blackPlayer: { select: { username: true } },
        },
        orderBy: { endedAt: "desc" },
        take: limit + 1,
      }),
      this.prisma.game.count({ where: filterWhere }),
    ]);

    const hasMore = games.length > limit;
    const slice = hasMore ? games.slice(0, limit) : games;

    const summaries: GameHistorySummaryDto[] = slice.map((g) => {
      const playedAsWhite = g.whiteUserId === userId;
      const opponentUsername = g.isVsComputer
        ? `Computer (Lv ${g.computerLevel ?? 1})`
        : playedAsWhite
          ? (g.blackPlayer?.username ?? "")
          : (g.whitePlayer?.username ?? "");

      let result: "win" | "loss" | "draw" | null = null;
      if (g.result === GameResult.draw) {
        result = "draw";
      } else if (
        (playedAsWhite && g.result === GameResult.white_wins) ||
        (!playedAsWhite && g.result === GameResult.black_wins)
      ) {
        result = "win";
      } else if (g.result !== null) {
        result = "loss";
      }

      let ratingDelta: number | null = null;
      if (
        playedAsWhite &&
        g.whiteRatingAfter !== null &&
        g.whiteRatingBefore !== null
      ) {
        ratingDelta = g.whiteRatingAfter - g.whiteRatingBefore;
      } else if (
        !playedAsWhite &&
        g.blackRatingAfter !== null &&
        g.blackRatingBefore !== null
      ) {
        ratingDelta = g.blackRatingAfter - g.blackRatingBefore;
      }

      return {
        id: g.id,
        opponentUsername,
        playedAs: playedAsWhite ? "white" : "black",
        result,
        ratingDelta,
        category: g.category as "bullet" | "blitz" | "rapid",
        timeControlSeconds: g.timeControlSeconds,
        incrementSeconds: g.incrementSeconds,
        isRated: g.isRated,
        isVsComputer: g.isVsComputer,
        endedAt: g.endedAt?.toISOString() ?? null,
      };
    });

    return {
      games: summaries,
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
      total,
    };
  }
}

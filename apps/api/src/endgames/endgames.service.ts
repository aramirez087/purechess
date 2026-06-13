import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import type {
  EndgameAttemptResultDto,
  EndgameCategoryDto,
  EndgameDrillDto,
  EndgameObjectiveDto,
  EndgameProbeDto,
} from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import { StreakService } from '../training/streak.service';
import { TablebaseService } from './tablebase.service';

/** The EndgameDrill columns we read for a DTO (the row shape, loosely typed). */
interface DrillRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  fen: string;
  objective: string;
  targetDtm: number | null;
  difficulty: number;
}

/**
 * The endgame-drills surface: list the curated bank (with the user's pass/fail
 * merged in when authed), fetch one, proxy the tablebase, and record attempts.
 *
 * Server-authoritative: the client reports an outcome (`succeeded`,
 * `movesPlayed`) and the row is persisted here — the client never decides its
 * own pass/fail history. The tablebase URL stays server-side (proxied through
 * `TablebaseService`, which caches every immutable result).
 */
@Injectable()
export class EndgamesService {
  private readonly logger = new Logger(EndgamesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tablebase: TablebaseService,
    // Optional, best-effort streak hook — an endgame attempt counts as a drill.
    // Provided via StreakModule in the wired app, absent (no-op) in the unit spec.
    @Optional() private readonly streakService?: StreakService,
  ) {}

  /**
   * List every drill, ordered by family then difficulty then name (stable). When
   * `userId` is set, each drill carries the user's `attempted`/`solved` flags
   * derived from their EndgameAttempt rows; `solved` is true if the user has
   * EVER passed it. Public (signed-out) callers pass `undefined` and get the
   * bare catalog.
   */
  async list(userId?: string): Promise<EndgameDrillDto[]> {
    const drills = await this.prisma.endgameDrill.findMany({
      orderBy: [{ category: 'asc' }, { difficulty: 'asc' }, { name: 'asc' }],
    });

    if (!userId) {
      return drills.map((d) => this.toDto(d as DrillRow));
    }

    // Two grouped reads: per drill, how many attempts (→ attempted) and how many
    // SUCCEEDED (→ solved iff ≥1). We count succeeded attempts rather than
    // `_max(succeeded)` because Postgres has no `max(boolean)` aggregate — a
    // `_max` on the boolean column throws `function max(boolean) does not exist`
    // (error 42883) against a real DB (the mocked unit specs never caught it).
    const [attemptCounts, successCounts] = await Promise.all([
      this.prisma.endgameAttempt.groupBy({
        by: ['drillId'],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.endgameAttempt.groupBy({
        by: ['drillId'],
        where: { userId, succeeded: true },
        _count: { _all: true },
      }),
    ]);
    const attemptedBy = new Map(attemptCounts.map((g) => [g.drillId, g._count._all]));
    const solvedBy = new Map(successCounts.map((g) => [g.drillId, g._count._all]));

    return drills.map((d) => {
      return this.toDto(d as DrillRow, {
        attempted: (attemptedBy.get(d.id) ?? 0) > 0,
        solved: (solvedBy.get(d.id) ?? 0) > 0,
      });
    });
  }

  /** Fetch one drill by slug. 404 when it doesn't exist. */
  async getBySlug(slug: string, userId?: string): Promise<EndgameDrillDto> {
    const drill = await this.prisma.endgameDrill.findUnique({ where: { slug } });
    if (!drill) throw new NotFoundException(`No endgame drill "${slug}"`);

    if (!userId) return this.toDto(drill as DrillRow);

    // Count attempts + successes separately — Postgres has no `max(boolean)`
    // aggregate, so `_max(succeeded)` throws (error 42883) against a real DB.
    const [attempts, successes] = await Promise.all([
      this.prisma.endgameAttempt.count({ where: { userId, drillId: drill.id } }),
      this.prisma.endgameAttempt.count({ where: { userId, drillId: drill.id, succeeded: true } }),
    ]);
    return this.toDto(drill as DrillRow, {
      attempted: attempts > 0,
      solved: successes > 0,
    });
  }

  /**
   * Probe a position for the drill `slug` (validates the slug exists so the
   * route can't be used as an open tablebase proxy). Delegates to the cached
   * `TablebaseService`; an out-of-tablebase / failed probe degrades to
   * 'unknown' so the client falls back to Stockfish.
   */
  async probe(slug: string, fen: string): Promise<EndgameProbeDto> {
    await this.requireDrill(slug);
    const result = await this.tablebase.probe(fen);
    const dto: EndgameProbeDto = { category: result.category };
    if (result.bestMove !== undefined) dto.bestMove = result.bestMove;
    if (result.dtm !== undefined) dto.dtm = result.dtm;
    return dto;
  }

  /**
   * Record one attempt for the user against drill `slug`. 404 when the slug is
   * unknown. Returns the persisted attempt.
   */
  async recordAttempt(
    userId: string,
    slug: string,
    input: { succeeded: boolean; movesPlayed: number },
  ): Promise<EndgameAttemptResultDto> {
    const drill = await this.requireDrill(slug);
    const attempt = await this.prisma.endgameAttempt.create({
      data: {
        userId,
        drillId: drill.id,
        succeeded: input.succeeded,
        movesPlayed: input.movesPlayed,
      },
    });

    // An endgame attempt counts as a drill toward the training streak. Best-
    // effort: a streak write never fails the recorded attempt.
    if (this.streakService) {
      try {
        await this.streakService.recordActivity(userId, 'drill');
      } catch (err) {
        this.logger.warn(
          `streak recordActivity failed for user ${userId} endgame ${slug}: ${String(err)}`,
        );
      }
    }

    return {
      drillId: drill.id,
      slug,
      succeeded: attempt.succeeded,
      movesPlayed: attempt.movesPlayed,
      recordedAt: attempt.createdAt.toISOString(),
    };
  }

  /** Resolve a drill by slug or 404. */
  private async requireDrill(slug: string): Promise<{ id: string }> {
    const drill = await this.prisma.endgameDrill.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!drill) throw new NotFoundException(`No endgame drill "${slug}"`);
    return drill;
  }

  private toDto(
    d: DrillRow,
    status?: { attempted: boolean; solved: boolean },
  ): EndgameDrillDto {
    const dto: EndgameDrillDto = {
      id: d.id,
      slug: d.slug,
      name: d.name,
      category: d.category as EndgameCategoryDto,
      fen: d.fen,
      objective: d.objective as EndgameObjectiveDto,
      difficulty: d.difficulty,
    };
    if (d.targetDtm !== null) dto.targetDtm = d.targetDtm;
    if (status) {
      dto.attempted = status.attempted;
      dto.solved = status.solved;
    }
    return dto;
  }
}

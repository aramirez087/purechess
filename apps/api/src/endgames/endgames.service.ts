import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  EndgameAttemptResultDto,
  EndgameCategoryDto,
  EndgameDrillDto,
  EndgameObjectiveDto,
  EndgameProbeDto,
} from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly tablebase: TablebaseService,
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

    // One grouped read: per drill, did the user attempt it and did any attempt
    // succeed? `_max.succeeded` is true iff at least one attempt passed.
    const grouped = await this.prisma.endgameAttempt.groupBy({
      by: ['drillId'],
      where: { userId },
      _count: { _all: true },
      _max: { succeeded: true },
    });
    const byDrill = new Map(grouped.map((g) => [g.drillId, g]));

    return drills.map((d) => {
      const stat = byDrill.get(d.id);
      return this.toDto(d as DrillRow, {
        attempted: (stat?._count._all ?? 0) > 0,
        solved: stat?._max.succeeded ?? false,
      });
    });
  }

  /** Fetch one drill by slug. 404 when it doesn't exist. */
  async getBySlug(slug: string, userId?: string): Promise<EndgameDrillDto> {
    const drill = await this.prisma.endgameDrill.findUnique({ where: { slug } });
    if (!drill) throw new NotFoundException(`No endgame drill "${slug}"`);

    if (!userId) return this.toDto(drill as DrillRow);

    const agg = await this.prisma.endgameAttempt.aggregate({
      where: { userId, drillId: drill.id },
      _count: { _all: true },
      _max: { succeeded: true },
    });
    return this.toDto(drill as DrillRow, {
      attempted: agg._count._all > 0,
      solved: agg._max.succeeded ?? false,
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

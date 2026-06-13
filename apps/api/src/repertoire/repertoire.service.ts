import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateRepertoireDto,
  ImportRepertoireDto,
  RepertoireColorDto,
  RepertoireDto,
  RepertoireNodeDto,
  RepertoireSummaryDto,
  UpdateRepertoireDto,
} from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import {
  countLines,
  countNodes,
  parsePgnToTree,
  RepertoireTreeError,
  validateTree,
  type ValidatedTree,
} from './repertoire-tree';

/** Prisma `Repertoire` row plus the latest-review timestamp for the summary. */
interface RepertoireRow {
  id: string;
  userId: string;
  name: string;
  color: RepertoireColorDto;
  rootFen: string;
  treeJson: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Per-user opening repertoires, stored as a serialized `AnalysisNode` move
 * tree in `Repertoire.treeJson`. CRUD + PGN/tree import. Every read/write is
 * scoped to the owning user — user A can never touch user B's rows (a
 * cross-user fetch raises `NotFoundException`, never leaks existence).
 *
 * Parse-side: the web client parses PGN into the tree (it owns the parser) and
 * posts `tree`; the server re-validates structure, root-FEN legality and a
 * sampled set of edges, and caps node count. A `pgn`-only import path parses
 * server-side via `parsePgnToTree` as a fallback.
 */
@Injectable()
export class RepertoireService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lightweight list (no tree payload) for the current user, newest first. */
  async list(userId: string): Promise<RepertoireSummaryDto[]> {
    const rows = (await this.prisma.repertoire.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })) as unknown as RepertoireRow[];

    // Latest drill per repertoire (RepertoireReview.updatedAt) in one query.
    const ids = rows.map((r) => r.id);
    const lastTrained = new Map<string, Date>();
    if (ids.length > 0) {
      const reviews = await this.prisma.repertoireReview.groupBy({
        by: ['repertoireId'],
        where: { userId, repertoireId: { in: ids } },
        _max: { updatedAt: true },
      });
      for (const g of reviews) {
        if (g._max.updatedAt) lastTrained.set(g.repertoireId, g._max.updatedAt);
      }
    }

    return rows.map((r) => this.toSummary(r, lastTrained.get(r.id)));
  }

  /** Full repertoire (with tree) — scoped to the owner. */
  async get(userId: string, id: string): Promise<RepertoireDto> {
    const row = await this.findOwned(userId, id);
    return this.toDto(row);
  }

  /** Creates a repertoire from a pre-built tree. */
  async create(userId: string, dto: CreateRepertoireDto): Promise<RepertoireDto> {
    const name = this.requireName(dto.name);
    const color = this.requireColor(dto.color);
    const validated = this.validate(dto.tree);

    const row = (await this.prisma.repertoire.create({
      data: {
        userId,
        name,
        color,
        rootFen: validated.rootFen,
        treeJson: validated.tree as unknown as Prisma.InputJsonValue,
      },
    })) as unknown as RepertoireRow;
    return this.toDto(row);
  }

  /** Partial update — name/color/tree. Ownership enforced. */
  async update(
    userId: string,
    id: string,
    dto: UpdateRepertoireDto,
  ): Promise<RepertoireDto> {
    await this.findOwned(userId, id); // ownership gate

    const data: Prisma.RepertoireUpdateInput = {};
    if (dto.name !== undefined) data.name = this.requireName(dto.name);
    if (dto.color !== undefined) data.color = this.requireColor(dto.color);
    if (dto.tree !== undefined) {
      const validated = this.validate(dto.tree);
      data.rootFen = validated.rootFen;
      data.treeJson = validated.tree as unknown as Prisma.InputJsonValue;
    }

    const row = (await this.prisma.repertoire.update({
      where: { id },
      data,
    })) as unknown as RepertoireRow;
    return this.toDto(row);
  }

  /** Deletes a repertoire (cascades its reviews). Ownership enforced. */
  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.findOwned(userId, id); // ownership gate
    await this.prisma.repertoire.delete({ where: { id } });
    return { id };
  }

  /**
   * Imports a repertoire from a pre-parsed `tree` (preferred — the client
   * parses PGN) or a raw `pgn` string (server parses). Rejects illegal and
   * oversized trees. Equivalent to `create` once a tree is resolved.
   */
  async import(userId: string, dto: ImportRepertoireDto): Promise<RepertoireDto> {
    const name = this.requireName(dto.name);
    const color = this.requireColor(dto.color);

    let tree: RepertoireNodeDto;
    if (dto.tree !== undefined) {
      tree = dto.tree;
    } else if (typeof dto.pgn === 'string' && dto.pgn.trim() !== '') {
      try {
        tree = parsePgnToTree(dto.pgn);
      } catch (err) {
        throw new BadRequestException(
          err instanceof RepertoireTreeError ? err.message : 'Could not parse PGN.',
        );
      }
    } else {
      throw new BadRequestException('Import requires either a tree or a PGN.');
    }

    const validated = this.validate(tree);
    const row = (await this.prisma.repertoire.create({
      data: {
        userId,
        name,
        color,
        rootFen: validated.rootFen,
        treeJson: validated.tree as unknown as Prisma.InputJsonValue,
      },
    })) as unknown as RepertoireRow;
    return this.toDto(row);
  }

  // --- internals -----------------------------------------------------------

  /** Fetches a row and asserts ownership; 404 on miss OR cross-user access. */
  private async findOwned(userId: string, id: string): Promise<RepertoireRow> {
    const row = (await this.prisma.repertoire.findUnique({
      where: { id },
    })) as unknown as RepertoireRow | null;
    if (!row) throw new NotFoundException('Repertoire not found.');
    if (row.userId !== userId) {
      // Don't leak existence — same 404 a missing row gives. (Also guards any
      // future caller that fetches without the userId filter.)
      throw new NotFoundException('Repertoire not found.');
    }
    return row;
  }

  /** Runs the structural + legality + size validation; maps errors to 400. */
  private validate(tree: unknown): ValidatedTree {
    try {
      return validateTree(tree);
    } catch (err) {
      if (err instanceof RepertoireTreeError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  private requireName(name: string): string {
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new BadRequestException('Repertoire name is required.');
    return trimmed;
  }

  private requireColor(color: RepertoireColorDto): RepertoireColorDto {
    if (color !== 'white' && color !== 'black') {
      throw new BadRequestException('Repertoire color must be white or black.');
    }
    return color;
  }

  private toDto(row: RepertoireRow): RepertoireDto {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      rootFen: row.rootFen,
      tree: row.treeJson as unknown as RepertoireNodeDto,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toSummary(row: RepertoireRow, lastTrainedAt?: Date): RepertoireSummaryDto {
    const tree = row.treeJson as unknown as RepertoireNodeDto;
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      rootFen: row.rootFen,
      lineCount: countLines(tree),
      nodeCount: countNodes(tree),
      lastTrainedAt: lastTrainedAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  DrillLineDto,
  DrillLinesDto,
  DrillStepDto,
  GradeDrillResultDto,
  RepertoireColorDto,
  RepertoireNodeDto,
} from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import {
  DEFAULT_EASE,
  schedule,
  type CardState,
  type ReviewGrade,
} from '../puzzles/spaced-repetition';
import { GRADUATION_INTERVAL_DAYS } from '../puzzles/puzzle-review.service';
import { StreakService } from '../training/streak.service';

/**
 * How many lines to queue for one drill session. Due (most-overdue) lines lead;
 * the remaining slots are filled with never-trained lines so a fresh repertoire
 * still has something to drill. Keeps a session short and finishable.
 */
export const DRILL_SESSION_LIMIT = 8;

/** Of a session, how many slots are reserved for brand-new (untrained) lines. */
export const NEW_LINES_PER_SESSION = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Prisma `Repertoire` row (the subset this service reads). */
interface RepertoireRow {
  id: string;
  userId: string;
  color: RepertoireColorDto;
  rootFen: string;
  treeJson: Prisma.JsonValue;
}

/** A root→leaf line enumerated from the tree, addressed by its serialized path. */
interface EnumeratedLine {
  /** Serialized leaf path — `''` for a bare root, else `idx.idx.idx`. */
  nodePath: string;
  steps: DrillStepDto[];
}

/**
 * The opening trainer queue. Drilling a repertoire walks each root→leaf line
 * from the user's side; this service decides WHICH lines to drill (due leaves
 * first, then a few never-trained ones) and reschedules each line with the
 * shared SM-2 {@link schedule} (the same pure scheduler the puzzle review queue
 * reuses — NOT a second implementation), persisted over `RepertoireReview`.
 *
 * A line is keyed in `RepertoireReview` by `(userId, repertoireId, nodePath)`
 * where `nodePath` is the serialized index-path to the line's LEAF node
 * (`path.join('.')`, `''` for the root). The `(userId, dueAt)` index drives the
 * due reads.
 */
@Injectable()
export class RepertoireReviewService {
  private readonly logger = new Logger(RepertoireReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Optional, best-effort streak hook — an opening-line drill counts as a
    // drill. Provided via StreakModule in the wired app, absent (no-op) in the
    // repertoire-review unit spec.
    @Optional() private readonly streakService?: StreakService,
  ) {}

  /**
   * The lines to drill this session: every line whose leaf is due now
   * (most-overdue first), then a few never-trained lines, capped at
   * {@link DRILL_SESSION_LIMIT}. Ownership is enforced — a missing or
   * cross-user repertoire raises 404 (no existence leak).
   */
  async getDrillLines(userId: string, repertoireId: string): Promise<DrillLinesDto> {
    const rep = await this.findOwned(userId, repertoireId);
    const tree = rep.treeJson as unknown as RepertoireNodeDto;
    const lines = enumerateLines(tree);
    const byPath = new Map(lines.map((l) => [l.nodePath, l]));

    // Existing review cards for THIS repertoire, keyed by nodePath.
    const reviews = await this.prisma.repertoireReview.findMany({
      where: { userId, repertoireId },
      select: { nodePath: true, dueAt: true },
    });
    const reviewByPath = new Map(reviews.map((r) => [r.nodePath, r.dueAt]));

    const now = new Date();

    // Due lines: a card exists, its dueAt <= now, AND the line still exists in
    // the tree (a stale card whose path was edited away is ignored). Sort the
    // most-overdue first, matching the puzzle queue's oldest-first ordering.
    const due = reviews
      .filter((r) => r.dueAt <= now && byPath.has(r.nodePath))
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .map((r) => byPath.get(r.nodePath) as EnumeratedLine);
    const dueLineCount = due.length;

    // New lines: never-trained leaves (no card row), in tree order.
    const newLines = lines.filter((l) => !reviewByPath.has(l.nodePath));

    // Compose the session: due leads, then fill with new lines up to the cap,
    // reserving at least NEW_LINES_PER_SESSION slots for new lines when both
    // exist so a long backlog never fully crowds out fresh material.
    const session: EnumeratedLine[] = [];
    const newQuota = Math.min(
      newLines.length,
      Math.max(NEW_LINES_PER_SESSION, DRILL_SESSION_LIMIT - due.length),
    );
    const dueQuota = DRILL_SESSION_LIMIT - newQuota;
    for (const l of due) {
      if (session.length >= dueQuota) break;
      session.push(l);
    }
    for (const l of newLines) {
      if (session.length >= DRILL_SESSION_LIMIT) break;
      session.push(l);
    }

    return {
      repertoireId,
      color: rep.color,
      lines: session.map((l) => this.toLineDto(l, rep.rootFen, reviewByPath)),
      dueLineCount,
    };
  }

  /**
   * Grade one drilled line and reschedule it. A clean line (every user move
   * correct on the first try) grades `good`; any miss grades `again` (lapses
   * the card back to ~1 day). Runs the shared {@link schedule} and upserts the
   * `RepertoireReview` row keyed by `(userId, repertoireId, nodePath)`.
   * Ownership is enforced.
   *
   * Unlike the puzzle queue, a drilled line is NEVER deleted on graduation:
   * a repertoire line you can play perfectly is still a line you want to keep
   * drilling occasionally, so the card stays scheduled at the grown interval.
   */
  async grade(
    userId: string,
    repertoireId: string,
    nodePath: string,
    correctFirstTry: boolean,
  ): Promise<GradeDrillResultDto> {
    await this.findOwned(userId, repertoireId); // ownership gate

    const existing = await this.findCard(userId, repertoireId, nodePath);
    const grade: ReviewGrade = correctFirstTry ? 'good' : 'again';
    const next = schedule(toCardState(existing), grade);
    const dueAt = offsetDays(next.nextDueOffsetDays);

    if (existing) {
      await this.prisma.repertoireReview.update({
        where: { id: existing.id },
        data: {
          dueAt,
          intervalDays: next.intervalDays,
          easeFactor: next.easeFactor,
          reps: next.reps,
          lapses: next.lapses,
        },
      });
    } else {
      await this.prisma.repertoireReview.create({
        data: {
          userId,
          repertoireId,
          nodePath,
          dueAt,
          intervalDays: next.intervalDays,
          easeFactor: next.easeFactor,
          reps: next.reps,
          lapses: next.lapses,
        },
      });
    }

    if (next.intervalDays > GRADUATION_INTERVAL_DAYS) {
      this.logger.log(
        `drill line mastered: user ${userId} rep ${repertoireId} path "${nodePath}" (interval ${next.intervalDays}d)`,
      );
    }

    // A graded drill line counts as a drill toward the training streak. Best-
    // effort: a streak write never fails the grade.
    if (this.streakService) {
      try {
        await this.streakService.recordActivity(userId, 'drill');
      } catch (err) {
        this.logger.warn(
          `streak recordActivity failed for user ${userId} rep ${repertoireId}: ${String(err)}`,
        );
      }
    }

    return { nodePath, nextDueAt: dueAt.toISOString(), intervalDays: next.intervalDays };
  }

  /**
   * Count of lines due to be drilled now, for the hub badge (S13). A line is
   * due when its `RepertoireReview.dueAt <= now`. Uses the `(userId, dueAt)`
   * index. Ownership is NOT re-checked here — the count is scoped to the
   * (userId, repertoireId) pair, so it can only ever count the caller's rows.
   */
  dueLineCount(userId: string, repertoireId: string): Promise<number> {
    return this.prisma.repertoireReview.count({
      where: { userId, repertoireId, dueAt: { lte: new Date() } },
    });
  }

  // --- internals -----------------------------------------------------------

  /** Fetches a repertoire and asserts ownership; 404 on miss OR cross-user. */
  private async findOwned(userId: string, id: string): Promise<RepertoireRow> {
    const row = (await this.prisma.repertoire.findUnique({
      where: { id },
      select: { id: true, userId: true, color: true, rootFen: true, treeJson: true },
    })) as RepertoireRow | null;
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Repertoire not found.');
    }
    return row;
  }

  private findCard(userId: string, repertoireId: string, nodePath: string) {
    return this.prisma.repertoireReview.findFirst({
      where: { userId, repertoireId, nodePath },
      select: {
        id: true,
        intervalDays: true,
        easeFactor: true,
        reps: true,
        lapses: true,
      },
    });
  }

  private toLineDto(
    line: EnumeratedLine,
    rootFen: string,
    reviewByPath: Map<string, Date>,
  ): DrillLineDto {
    return {
      nodePath: line.nodePath,
      rootFen,
      steps: line.steps,
      isNew: !reviewByPath.has(line.nodePath),
    };
  }
}

/**
 * Enumerates every root→leaf line of the tree, depth-first, each addressed by
 * the serialized index-path to its LEAF (`path.join('.')`, `''` for a bare
 * root). Iterative so a deep megabase chain can't overflow the call stack.
 *
 * A "line" is the full move sequence from the root to a leaf node (a node with
 * no children). The leaf's path is the scheduling key; the steps carry every
 * ply so the drill can auto-play the opponent's moves and check the user's.
 */
export function enumerateLines(root: RepertoireNodeDto): EnumeratedLine[] {
  const lines: EnumeratedLine[] = [];
  // A bare root (no moves) is not a drillable line.
  if (root.children.length === 0) return lines;

  interface Frame {
    node: RepertoireNodeDto;
    path: number[];
    steps: DrillStepDto[];
  }
  const stack: Frame[] = [];
  // Seed with the root's children (the root itself contributes no step).
  for (let i = root.children.length - 1; i >= 0; i--) {
    const child = root.children[i];
    stack.push({ node: child, path: [i], steps: [stepOf(child)] });
  }

  while (stack.length > 0) {
    const frame = stack.pop() as Frame;
    if (frame.node.children.length === 0) {
      lines.push({ nodePath: frame.path.join('.'), steps: frame.steps });
      continue;
    }
    for (let i = frame.node.children.length - 1; i >= 0; i--) {
      const child = frame.node.children[i];
      stack.push({
        node: child,
        path: [...frame.path, i],
        steps: [...frame.steps, stepOf(child)],
      });
    }
  }

  return lines;
}

function stepOf(node: RepertoireNodeDto): DrillStepDto {
  return { san: node.san, uci: node.uci, fen: node.fen };
}

/** Map a stored review row (or absent row) to a schedulable card state. */
function toCardState(
  row: Pick<CardState, 'intervalDays' | 'easeFactor' | 'reps' | 'lapses'> | null,
): CardState {
  if (!row) {
    return { intervalDays: 0, easeFactor: DEFAULT_EASE, reps: 0, lapses: 0 };
  }
  return {
    intervalDays: row.intervalDays,
    easeFactor: row.easeFactor,
    reps: row.reps,
    lapses: row.lapses,
  };
}

/** A Date `days` from now (whole-day offset). */
function offsetDays(days: number): Date {
  return new Date(Date.now() + days * MS_PER_DAY);
}

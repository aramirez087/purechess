import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import type {
  DrillLineDto,
  DrillStepDto,
  GradeDrillResultDto,
  LabDrillLinesDto,
  RepertoireColorDto,
} from '@purechess/shared';
import { offsetDays, schedule, toCardState, type ReviewGrade } from '../puzzles/spaced-repetition';
import { StreakService } from '../training/streak.service';
import {
  getFamilyEntries,
  mainlineStepsFromPgn,
  type OpeningBookEntry,
} from './opening-lab-book';

export const LAB_DRILL_SESSION_LIMIT = 8;
export const LAB_NEW_LINES_PER_SESSION = 3;

interface LabReviewCard {
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
}

function reviewKey(userId: string, color: RepertoireColorDto): string {
  return `opening:lab:review:${userId}:${color}`;
}

function fieldKey(family: string, epd: string): string {
  return `${family}\u0000${epd}`;
}

/**
 * Family-scoped opening drill with Redis-backed SM-2 scheduling (no Prisma
 * migration). Each book variation is one drill line; `nodePath` = EPD.
 */
@Injectable()
export class OpeningLabReviewService {
  private readonly logger = new Logger(OpeningLabReviewService.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @Optional() private readonly streakService?: StreakService,
  ) {}

  async getDrillLines(
    userId: string,
    family: string,
    color: RepertoireColorDto,
  ): Promise<LabDrillLinesDto> {
    const entries = getFamilyEntries(family);
    if (entries.length === 0) {
      throw new BadRequestException(`Unknown opening family: ${family}`);
    }
    const resolvedFamily = entries[0].family;
    const lines = entries
      .map((e) => this.toDrillLine(e))
      .filter((l) => l.steps.length > 0);

    const reviewMap = await this.loadReviews(userId, color, resolvedFamily);
    const now = new Date();

    const due = lines
      .filter((l) => {
        const card = reviewMap.get(l.nodePath);
        return card && new Date(card.dueAt) <= now;
      })
      .sort((a, b) => {
        const da = reviewMap.get(a.nodePath)!.dueAt;
        const db = reviewMap.get(b.nodePath)!.dueAt;
        return new Date(da).getTime() - new Date(db).getTime();
      });

    const dueLineCount = due.length;
    const newLines = lines.filter((l) => !reviewMap.has(l.nodePath));

    const session: DrillLineDto[] = [];
    const newQuota = Math.min(
      newLines.length,
      Math.max(LAB_NEW_LINES_PER_SESSION, LAB_DRILL_SESSION_LIMIT - due.length),
    );
    const dueQuota = LAB_DRILL_SESSION_LIMIT - newQuota;

    for (const l of due) {
      if (session.length >= dueQuota) break;
      session.push({ ...l, isNew: false });
    }
    for (const l of newLines) {
      if (session.length >= LAB_DRILL_SESSION_LIMIT) break;
      session.push({ ...l, isNew: true });
    }

    return {
      family: resolvedFamily,
      color,
      lines: session,
      dueLineCount,
      totalLinesInFamily: lines.length,
    };
  }

  async grade(
    userId: string,
    family: string,
    epd: string,
    color: RepertoireColorDto,
    correctFirstTry: boolean,
  ): Promise<GradeDrillResultDto> {
    const entries = getFamilyEntries(family);
    if (entries.length === 0) {
      throw new BadRequestException(`Unknown opening family: ${family}`);
    }
    const resolvedFamily = entries[0].family;
    const entry = entries.find((e) => e.epd === epd);
    if (!entry) {
      throw new BadRequestException('Line not found in this family.');
    }

    const key = reviewKey(userId, color);
    const field = fieldKey(resolvedFamily, epd);
    const existingRaw = await this.redis.hget(key, field);
    const existing = existingRaw ? (JSON.parse(existingRaw) as LabReviewCard) : null;

    const grade: ReviewGrade = correctFirstTry ? 'good' : 'again';
    const next = schedule(toCardState(existing), grade);
    const dueAt = offsetDays(next.nextDueOffsetDays);

    const card: LabReviewCard = {
      dueAt: dueAt.toISOString(),
      intervalDays: next.intervalDays,
      easeFactor: next.easeFactor,
      reps: next.reps,
      lapses: next.lapses,
    };
    await this.redis.hset(key, field, JSON.stringify(card));

    if (this.streakService) {
      try {
        await this.streakService.recordActivity(userId, 'drill');
      } catch (err) {
        this.logger.warn(`streak recordActivity failed for lab drill: ${String(err)}`);
      }
    }

    return { nodePath: epd, nextDueAt: dueAt.toISOString(), intervalDays: next.intervalDays };
  }

  private async loadReviews(
    userId: string,
    color: RepertoireColorDto,
    family: string,
  ): Promise<Map<string, LabReviewCard>> {
    const all = await this.redis.hgetall(reviewKey(userId, color));
    const prefix = `${family}\u0000`;
    const map = new Map<string, LabReviewCard>();
    for (const [field, raw] of Object.entries(all)) {
      if (!field.startsWith(prefix)) continue;
      const epd = field.slice(prefix.length);
      map.set(epd, JSON.parse(raw) as LabReviewCard);
    }
    return map;
  }

  private toDrillLine(entry: OpeningBookEntry): DrillLineDto {
    const { rootFen, steps } = mainlineStepsFromPgn(entry.pgn);
    return {
      nodePath: entry.epd,
      rootFen,
      steps: steps as DrillStepDto[],
      isNew: true,
    };
  }
}
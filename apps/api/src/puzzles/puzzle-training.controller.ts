import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type {
  PuzzleAttemptResultDto,
  PuzzleDto,
  PuzzleHistoryDto,
  PuzzleRatingDto,
  PuzzleThemeDto,
  PuzzleThemeStatDto,
} from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PuzzleCatalogService } from './puzzle-catalog.service';
import { PuzzleServingService } from './puzzle-serving.service';
import { PuzzleRatingService } from './puzzle-rating.service';
import { PuzzleHistoryService } from './puzzle-history.service';
import { RecordAttemptDto } from './dto/record-attempt.dto';

/**
 * Trainer endpoints — the local puzzle bank, per-user serving, attempt
 * recording, stats, and puzzle rating. Registered additively in
 * `PuzzlesModule`; the daily-puzzle controller (`GET /puzzles/daily`) is
 * untouched. `GET /puzzles/themes` is public (powers the empty-state picker);
 * everything else is auth-gated and scoped to the current user.
 */
@Controller('puzzles')
export class PuzzleTrainingController {
  constructor(
    private readonly catalog: PuzzleCatalogService,
    private readonly serving: PuzzleServingService,
    private readonly rating: PuzzleRatingService,
    private readonly historyService: PuzzleHistoryService,
  ) {}

  /** Public: the theme catalog (slug + count) for the picker / empty-state. */
  @Get('themes')
  async listThemes(): Promise<PuzzleThemeDto[]> {
    const themes = await this.catalog.listThemes();
    return themes.map((t) => ({ slug: t.theme, label: t.theme, puzzleCount: t.count }));
  }

  /** Next puzzle in the user's rating window (optionally theme-filtered). */
  @Get('next')
  @UseGuards(SessionAuthGuard)
  getNext(
    @CurrentUser() user: User,
    @Query('theme') theme?: string,
    @Query('rating') rating?: string,
  ): Promise<PuzzleDto> {
    const parsedRating =
      rating != null && rating !== '' && Number.isFinite(Number(rating))
        ? Number(rating)
        : undefined;
    return this.serving.getNext(user.id, { theme, rating: parsedRating });
  }

  /** Records the outcome of an attempt and returns the rating move. */
  @Post(':id/attempt')
  @UseGuards(SessionAuthGuard)
  @HttpCode(200)
  recordAttempt(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RecordAttemptDto,
  ): Promise<PuzzleAttemptResultDto> {
    return this.serving.recordAttempt(user.id, id, {
      solved: dto.solved,
      msToSolve: dto.msToSolve,
      source: dto.source,
    });
  }

  /** Per-theme accuracy for the user, weakest first. */
  @Get('stats')
  @UseGuards(SessionAuthGuard)
  getStats(@CurrentUser() user: User): Promise<PuzzleThemeStatDto[]> {
    return this.serving.getStats(user.id);
  }

  /** The user's current puzzle Glicko snapshot. */
  @Get('rating')
  @UseGuards(SessionAuthGuard)
  getRating(@CurrentUser() user: User): Promise<PuzzleRatingDto> {
    return this.rating.get(user.id);
  }

  /**
   * The user's puzzle-rating curve (bucketed + capped) plus the headline
   * summary (rating, accuracy, weakest theme) for the stats surface.
   */
  @Get('history')
  @UseGuards(SessionAuthGuard)
  getHistory(@CurrentUser() user: User): Promise<PuzzleHistoryDto> {
    return this.historyService.history(user.id);
  }
}

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
  GameMistakeDto,
  SaveMistakesResultDto,
} from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GameMistakeService } from './game-mistake.service';
import { SaveMistakesDto } from './dto/save-mistakes.dto';

/** Result of marking a mistake reviewed: the next unreviewed mistake (or null). */
interface MarkReviewedResult {
  next: GameMistakeDto | null;
}

/**
 * Endpoints for "mistakes from your own games" (S07). Every route is auth-gated
 * (`purechess_session`) and scoped to the current user; the service re-derives
 * and verifies each claimed position so the client is never trusted for what it
 * blundered or whose game it was.
 *
 * Registered additively in `PuzzlesModule` (its own controller file). Uses
 * absolute method paths (no base prefix) because the routes span two trees:
 * the game-scoped write (`/games/:gameId/mistakes`) and the user-scoped reads
 * (`/me/mistakes`). With the global `api` prefix these are `/api/...`.
 */
@Controller()
@UseGuards(SessionAuthGuard)
export class GameMistakeController {
  constructor(private readonly mistakes: GameMistakeService) {}

  /** Persist the user's own over-threshold mistakes from a game; returns the saved count. */
  @Post('games/:gameId/mistakes')
  @HttpCode(200)
  async save(
    @CurrentUser() user: User,
    @Param('gameId') gameId: string,
    @Body() dto: SaveMistakesDto,
  ): Promise<SaveMistakesResultDto> {
    const saved = await this.mistakes.saveMistakes(user.id, gameId, dto.mistakes);
    return { saved };
  }

  /** List the user's mistakes (newest first). `?unreviewedOnly=true` for the backlog only. */
  @Get('me/mistakes')
  list(
    @CurrentUser() user: User,
    @Query('unreviewedOnly') unreviewedOnly?: string,
  ): Promise<GameMistakeDto[]> {
    return this.mistakes.listMistakes(user.id, {
      unreviewedOnly: unreviewedOnly === 'true' || unreviewedOnly === '1',
    });
  }

  /** Mark a mistake reviewed (re-solved); returns the next unreviewed mistake. */
  @Post('me/mistakes/:id/review')
  @HttpCode(200)
  async markReviewed(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<MarkReviewedResult> {
    const next = await this.mistakes.markReviewed(user.id, id);
    return { next };
  }
}

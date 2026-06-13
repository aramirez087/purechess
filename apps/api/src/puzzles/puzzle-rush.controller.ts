import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import type {
  RushFinishResponseDto,
  RushMode,
  RushPersonalBestsDto,
  RushStartResponseDto,
} from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PuzzleRushService } from './puzzle-rush.service';
import { RushFinishDto, RushStartDto } from './dto/rush.dto';

/**
 * Puzzle Rush endpoints — the timed board-vision drill. Registered additively
 * in `PuzzlesModule` alongside the daily + trainer controllers (the known
 * Wave-3 merge seam is a single line in the module). Every route is auth-gated
 * and scoped to the current user (cookie `purechess_session`).
 *
 * NOTE ON SOLUTION PROTECTION: the whole set (including solution lines) is sent
 * to the client at `start`, so rush is honor-system client-side — exactly like
 * the existing daily/trainer solve loop, which also ships `PuzzleDto.moves`. We
 * deliberately chose the simpler honest option over move-by-move serving: rush
 * scores feed only a Redis personal best (not a competitive ladder), and each
 * solved puzzle still records a normal server-authoritative `PuzzleAttempt`
 * (the rating/stat signal the client cannot forge). See the service header.
 */
@Controller('puzzles/rush')
export class PuzzleRushController {
  constructor(private readonly rush: PuzzleRushService) {}

  /** Assembles an escalating set and returns its run id + puzzles. */
  @Post('start')
  @UseGuards(SessionAuthGuard)
  @HttpCode(200)
  async start(@CurrentUser() user: User, @Body() dto: RushStartDto): Promise<RushStartResponseDto> {
    const mode: RushMode = dto.mode ?? '3min';
    const { runId, puzzles } = await this.rush.buildSet(user.id, mode);
    return { runId, puzzles, mode };
  }

  /** Records the finished run and returns the personal best + PB flag. */
  @Post('finish')
  @UseGuards(SessionAuthGuard)
  @HttpCode(200)
  async finish(
    @CurrentUser() user: User,
    @Body() dto: RushFinishDto,
  ): Promise<RushFinishResponseDto> {
    const mode: RushMode = dto.mode ?? '3min';
    const { best, isPB } = await this.rush.recordRun(user.id, {
      mode,
      score: dto.score,
      durationMs: dto.durationMs,
    });
    return { best, isPB, mode };
  }

  /** The user's personal best per mode (for the pre-run screen). */
  @Get('pb')
  @UseGuards(SessionAuthGuard)
  getPersonalBests(@CurrentUser() user: User): Promise<RushPersonalBestsDto> {
    return this.rush.getPersonalBests(user.id);
  }
}

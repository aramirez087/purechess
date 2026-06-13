import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type {
  EndgameAttemptResultDto,
  EndgameDrillDto,
  EndgameProbeDto,
} from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { OptionalSessionAuthGuard } from '../auth/guards/optional-session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EndgamesService } from './endgames.service';
import { ProbeFenDto } from './dto/probe.dto';
import { RecordEndgameAttemptDto } from './dto/attempt.dto';

/**
 * Endgame drills — the curated must-know endgame bank, tablebase proxy, and
 * attempt recording.
 *
 * `GET /endgames` and `GET /endgames/:slug` are PUBLIC (no session required) but
 * fold in the user's pass/fail when a session cookie is present
 * (`OptionalSessionAuthGuard` populates `req.user` or leaves it undefined).
 * `POST /endgames/:slug/probe` is public too (it just proxies the cached
 * tablebase — the URL stays server-side). `POST /endgames/:slug/attempt` is
 * auth-gated and scoped to the current user.
 */
@Controller('endgames')
export class EndgamesController {
  constructor(private readonly endgames: EndgamesService) {}

  /** All drills, with per-user pass/fail merged in when authed. */
  @Get()
  @UseGuards(OptionalSessionAuthGuard)
  list(@CurrentUser() user?: User): Promise<EndgameDrillDto[]> {
    return this.endgames.list(user?.id);
  }

  /** One drill by slug (with the user's status when authed). */
  @Get(':slug')
  @UseGuards(OptionalSessionAuthGuard)
  get(
    @Param('slug') slug: string,
    @CurrentUser() user?: User,
  ): Promise<EndgameDrillDto> {
    return this.endgames.getBySlug(slug, user?.id);
  }

  /** Probe a position via the cached, server-side tablebase. */
  @Post(':slug/probe')
  @HttpCode(200)
  probe(
    @Param('slug') slug: string,
    @Body() dto: ProbeFenDto,
  ): Promise<EndgameProbeDto> {
    return this.endgames.probe(slug, dto.fen);
  }

  /** Record the outcome of an attempt (auth required). */
  @Post(':slug/attempt')
  @UseGuards(SessionAuthGuard)
  @HttpCode(200)
  recordAttempt(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Body() dto: RecordEndgameAttemptDto,
  ): Promise<EndgameAttemptResultDto> {
    return this.endgames.recordAttempt(user.id, slug, {
      succeeded: dto.succeeded,
      movesPlayed: dto.movesPlayed,
    });
  }
}

import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { MatchmakingJoinResponseDto, MatchmakingStatusDto } from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MatchmakingService } from './matchmaking.service';
import { JoinMatchmakingDto } from './dto/join-matchmaking.dto';

/** Quick-match queue — auth required for both rated and casual pools. */
@Controller('matchmaking')
@UseGuards(SessionAuthGuard, EmailVerifiedGuard)
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Post('join')
  join(
    @Body() dto: JoinMatchmakingDto,
    @CurrentUser() user: User,
  ): Promise<MatchmakingJoinResponseDto> {
    return this.matchmakingService.join(user.id, dto);
  }

  @Post('leave')
  @HttpCode(200)
  leave(@CurrentUser() user: User): Promise<{ ok: true }> {
    return this.matchmakingService.leave(user.id);
  }

  @Get('status')
  status(@CurrentUser() user: User): Promise<MatchmakingStatusDto> {
    return this.matchmakingService.status(user.id);
  }
}

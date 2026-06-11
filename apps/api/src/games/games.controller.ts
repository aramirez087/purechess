import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import {
  PvpDrawActionDto,
  PvpGameStateDto,
  PvpMoveDto,
  PvpRematchActionDto,
} from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GamesService } from './games.service';

/** Live PvP (friend-invite) games — players only, session required. */
@Controller('games')
@UseGuards(SessionAuthGuard)
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get(':id/state')
  getState(@Param('id') id: string, @CurrentUser() user: User): Promise<PvpGameStateDto> {
    return this.gamesService.getState(id, user.id);
  }

  @Post(':id/move')
  @HttpCode(200)
  submitMove(
    @Param('id') id: string,
    @Body() dto: PvpMoveDto,
    @CurrentUser() user: User,
  ): Promise<PvpGameStateDto> {
    return this.gamesService.submitMove(id, user.id, dto.move);
  }

  @Post(':id/resign')
  @HttpCode(200)
  resign(@Param('id') id: string, @CurrentUser() user: User): Promise<PvpGameStateDto> {
    return this.gamesService.resign(id, user.id);
  }

  @Post(':id/draw')
  @HttpCode(200)
  draw(
    @Param('id') id: string,
    @Body() dto: PvpDrawActionDto,
    @CurrentUser() user: User,
  ): Promise<PvpGameStateDto> {
    return this.gamesService.draw(id, user.id, dto.action);
  }

  @Post(':id/abort')
  @HttpCode(200)
  abort(@Param('id') id: string, @CurrentUser() user: User): Promise<PvpGameStateDto> {
    return this.gamesService.abort(id, user.id);
  }

  @Post(':id/rematch')
  @HttpCode(200)
  rematch(
    @Param('id') id: string,
    @Body() dto: PvpRematchActionDto,
    @CurrentUser() user: User,
  ): Promise<PvpGameStateDto> {
    return this.gamesService.rematch(id, user.id, dto.action);
  }
}

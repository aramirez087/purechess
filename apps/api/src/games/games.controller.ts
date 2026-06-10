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
import { PvpGameStateDto, PvpMoveDto } from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GamesService } from './games.service';

/** Live PvP (friend-invite) games — players only, session required. */
@Controller('games')
@UseGuards(SessionAuthGuard)
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get(':id/state')
  getState(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<PvpGameStateDto> {
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
  resign(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<PvpGameStateDto> {
    return this.gamesService.resign(id, user.id);
  }
}

import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { ComputerMoveDto, ComputerGameStateDto, CreateComputerGameDto } from '@purechess/shared';
import { OptionalSessionAuthGuard } from '../auth/guards/optional-session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ComputerGamesService } from './computer-games.service';

@Controller('computer-games')
@UseGuards(OptionalSessionAuthGuard)
export class ComputerGamesController {
  constructor(private readonly service: ComputerGamesService) {}

  @Post()
  @HttpCode(201)
  createGame(
    @Body() dto: CreateComputerGameDto,
    @CurrentUser() user: User | undefined,
  ): Promise<ComputerGameStateDto> {
    return this.service.createGame(user?.id ?? null, dto);
  }

  @Post(':id/move')
  @HttpCode(200)
  submitMove(
    @Param('id') id: string,
    @Body() dto: ComputerMoveDto,
    @CurrentUser() user: User | undefined,
  ): Promise<ComputerGameStateDto> {
    return this.service.submitMove(id, user?.id ?? null, dto);
  }

  @Get(':id')
  getGame(
    @Param('id') id: string,
    @CurrentUser() user: User | undefined,
  ): Promise<ComputerGameStateDto> {
    return this.service.getGame(id, user?.id ?? null);
  }
}

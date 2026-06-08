import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import {
  AbortDto,
  ComputerMoveDto,
  ComputerGameStateDto,
  CreateComputerGameDto,
  CreateFromFenDto,
  DrawActionDto,
  RematchDto,
  RewindToPlyDto,
  TakebackDto,
} from '@purechess/shared';
import { OptionalSessionAuthGuard } from '../auth/guards/optional-session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ComputerGamesService } from './computer-games.service';
import { ComputerGameActionsService } from './computer-game-actions.service';

@Controller('computer-games')
@UseGuards(OptionalSessionAuthGuard)
export class ComputerGamesController {
  constructor(
    private readonly service: ComputerGamesService,
    private readonly actions: ComputerGameActionsService,
  ) {}

  @Post()
  @HttpCode(201)
  createGame(
    @Body() dto: CreateComputerGameDto,
    @CurrentUser() user: User | undefined,
  ): Promise<ComputerGameStateDto> {
    return this.service.createGame(user?.id ?? null, dto);
  }

  @Post('from-fen')
  @HttpCode(201)
  createGameFromFen(
    @Body() dto: CreateFromFenDto,
    @CurrentUser() user: User | undefined,
  ): Promise<ComputerGameStateDto> {
    return this.service.createGameFromFen(user?.id ?? null, dto);
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

  @Post(':id/takeback')
  @HttpCode(200)
  takeback(
    @Param('id') id: string,
    @Body() dto: TakebackDto,
    @CurrentUser() user: User | undefined,
  ): Promise<ComputerGameStateDto> {
    return this.actions.takeback(id, user?.id ?? null, dto.plies);
  }

  @Post(':id/rewind')
  @HttpCode(200)
  rewind(
    @Param('id') id: string,
    @Body() dto: RewindToPlyDto,
    @CurrentUser() user: User | undefined,
  ): Promise<ComputerGameStateDto> {
    return this.actions.rewind(id, user?.id ?? null, dto.ply);
  }

  @Post(':id/abort')
  @HttpCode(200)
  abort(
    @Param('id') id: string,
    @Body() _dto: AbortDto,
    @CurrentUser() user: User | undefined,
  ): Promise<ComputerGameStateDto> {
    return this.actions.abort(id, user?.id ?? null);
  }

  @Post(':id/draw')
  @HttpCode(200)
  draw(
    @Param('id') id: string,
    @Body() dto: DrawActionDto,
    @CurrentUser() user: User | undefined,
  ): Promise<ComputerGameStateDto> {
    return this.actions.draw(id, user?.id ?? null, dto.action);
  }

  @Post(':id/rematch')
  @HttpCode(201)
  rematch(
    @Param('id') id: string,
    @Body() dto: RematchDto,
    @CurrentUser() user: User | undefined,
  ): Promise<ComputerGameStateDto> {
    return this.actions.rematch(id, user?.id ?? null, dto.swapColors);
  }

  @Get(':id')
  getGame(
    @Param('id') id: string,
    @CurrentUser() user: User | undefined,
  ): Promise<ComputerGameStateDto> {
    return this.service.getGame(id, user?.id ?? null);
  }
}

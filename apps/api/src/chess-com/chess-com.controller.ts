import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type {
  ChessComGamesDto,
  ChessComLinkDto,
  ChessComOpeningMistakesDto,
  SaveChessComMistakesDto,
  SetChessComLinkDto,
} from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChessComService } from './chess-com.service';

@Controller('chess-com')
@UseGuards(SessionAuthGuard)
export class ChessComController {
  constructor(private readonly service: ChessComService) {}

  @Get('link')
  getLink(@CurrentUser() user: User): Promise<ChessComLinkDto> {
    return this.service.getLink(user.id);
  }

  @Put('link')
  setLink(
    @CurrentUser() user: User,
    @Body() dto: SetChessComLinkDto,
  ): Promise<ChessComLinkDto> {
    return this.service.setLink(user.id, dto.username);
  }

  @Delete('link')
  @HttpCode(200)
  clearLink(@CurrentUser() user: User): Promise<ChessComLinkDto> {
    return this.service.clearLink(user.id);
  }

  @Get('games')
  fetchGames(@CurrentUser() user: User): Promise<ChessComGamesDto> {
    return this.service.fetchGames(user.id);
  }

  @Get('opening-mistakes')
  listMistakes(@CurrentUser() user: User): Promise<ChessComOpeningMistakesDto> {
    return this.service.listMistakes(user.id);
  }

  @Post('opening-mistakes')
  @HttpCode(200)
  saveMistakes(
    @CurrentUser() user: User,
    @Body() dto: SaveChessComMistakesDto,
  ): Promise<ChessComOpeningMistakesDto> {
    return this.service.saveMistakes(user.id, dto);
  }

  @Post('sync-complete')
  @HttpCode(200)
  syncComplete(
    @CurrentUser() user: User,
    @Body() body: { gamesScanned: number },
  ): Promise<ChessComLinkDto> {
    return this.service.recordSync(user.id, body.gamesScanned);
  }

  @Post('opening-mistakes/:gameId/:ply/reviewed')
  @HttpCode(204)
  async markReviewed(
    @CurrentUser() user: User,
    @Param('gameId') gameId: string,
    @Param('ply') ply: string,
  ): Promise<void> {
    await this.service.markReviewed(user.id, decodeURIComponent(gameId), Number(ply));
  }
}
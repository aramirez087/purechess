import { Module } from '@nestjs/common';
import { ComputerGamesController } from './computer-games.controller';
import { ComputerGamesService } from './computer-games.service';
import { StockfishService } from './stockfish.service';

@Module({
  controllers: [ComputerGamesController],
  providers: [ComputerGamesService, StockfishService],
})
export class ComputerGamesModule {}

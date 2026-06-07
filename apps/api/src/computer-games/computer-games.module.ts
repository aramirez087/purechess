import { Module } from '@nestjs/common';
import { ChessEngineModule } from '../chess/chess.module';
import { ComputerGamesController } from './computer-games.controller';
import { ComputerGamesService } from './computer-games.service';
import { StockfishService } from './stockfish.service';

@Module({
  imports: [ChessEngineModule],
  controllers: [ComputerGamesController],
  providers: [ComputerGamesService, StockfishService],
})
export class ComputerGamesModule {}

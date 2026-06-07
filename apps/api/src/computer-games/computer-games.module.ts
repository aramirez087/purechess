import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChessEngineModule } from '../chess/chess.module';
import { ComputerGamesController } from './computer-games.controller';
import { ComputerGamesService } from './computer-games.service';

@Module({
  imports: [ChessEngineModule, AuthModule],
  controllers: [ComputerGamesController],
  providers: [ComputerGamesService],
})
export class ComputerGamesModule {}

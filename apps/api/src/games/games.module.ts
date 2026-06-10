import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChessEngineModule } from '../chess/chess.module';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

@Module({
  imports: [ChessEngineModule, AuthModule],
  controllers: [GamesController],
  providers: [GamesService],
  exports: [GamesService],
})
export class GamesModule {}

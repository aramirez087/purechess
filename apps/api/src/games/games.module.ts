import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChessEngineModule } from '../chess/chess.module';
import { RatingsModule } from '../ratings/ratings.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

@Module({
  imports: [ChessEngineModule, AuthModule, RealtimeModule, RatingsModule],
  controllers: [GamesController],
  providers: [GamesService],
  exports: [GamesService],
})
export class GamesModule {}

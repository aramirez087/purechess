import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChessEngineModule } from '../chess/chess.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { RatingsModule } from '../ratings/ratings.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GamesJanitorService } from './games-janitor.service';

@Module({
  imports: [ChessEngineModule, AuthModule, RealtimeModule, RatingsModule, MatchmakingModule],
  controllers: [GamesController],
  providers: [GamesService, GamesJanitorService],
  exports: [GamesService],
})
export class GamesModule {}

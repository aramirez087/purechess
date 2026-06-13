import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StreakModule } from '../training/streak.module';
import { EndgamesController } from './endgames.controller';
import { EndgamesService } from './endgames.service';
import { TablebaseService } from './tablebase.service';

/**
 * Endgame drills (curated bank + tablebase proxy + attempt recording).
 * `AuthModule` supplies `SessionAuthGuard`/`OptionalSessionAuthGuard` +
 * `SessionsService`; Prisma comes from the global `DatabaseModule` and the
 * Redis client (used by `TablebaseService` for the immutable probe cache) from
 * the global `RedisModule`. `EndgamesService` is exported so the S13 hub and the
 * S12 "endgame gaps" insight can read drill outcomes directly.
 */
@Module({
  imports: [AuthModule, StreakModule],
  controllers: [EndgamesController],
  providers: [EndgamesService, TablebaseService],
  exports: [EndgamesService, TablebaseService],
})
export class EndgamesModule {}

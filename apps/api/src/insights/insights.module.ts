import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PuzzlesModule } from '../puzzles/puzzles.module';
import { EndgamesModule } from '../endgames/endgames.module';
import { RepertoireModule } from '../repertoire/repertoire.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

/**
 * The insights / weakness engine (`GET /train/insights`). Read-only: it mines
 * the existing training signals into a ranked weakness list.
 *
 * Imports supply the per-domain aggregators it injects: `PuzzlesModule`
 * (PuzzleServingService + GameMistakeService), `EndgamesModule`
 * (EndgamesService), `RepertoireModule` (RepertoireReviewService), and
 * `AuthModule` (SessionAuthGuard + SessionsService). Prisma + the Redis client
 * (for the per-user cache) come from the global Database/Redis modules.
 * `InsightsService` is exported so the S13 hub can embed the top insight.
 */
@Module({
  imports: [AuthModule, PuzzlesModule, EndgamesModule, RepertoireModule],
  controllers: [InsightsController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}

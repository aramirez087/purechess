import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PuzzlesModule } from '../puzzles/puzzles.module';
import { InsightsModule } from '../insights/insights.module';
import { StreakModule } from './streak.module';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { CLOCK, SYSTEM_CLOCK } from './clock';

/**
 * The training hub (`/train/plan`, `/train/streak`, `/train/goal`). Turns the
 * pile of training tools into one daily habit: a concrete ~10-minute plan aimed
 * at the user's weakest thing, plus the streak that rewards showing up.
 *
 * Imports supply the live signals `TrainingService` composes: `PuzzlesModule`
 * (PuzzleHistoryService weakest-theme summary + PuzzleReviewService due count),
 * `InsightsModule` (the top insight that may add an opening/endgame drill), and
 * `StreakModule` (the streak read + goal write). `AuthModule` supplies the
 * SessionAuthGuard. Prisma + Redis come from the global modules.
 */
@Module({
  imports: [AuthModule, PuzzlesModule, InsightsModule, StreakModule],
  controllers: [TrainingController],
  providers: [TrainingService, { provide: CLOCK, useValue: SYSTEM_CLOCK }],
  exports: [TrainingService],
})
export class TrainingModule {}

import { Module } from '@nestjs/common';
import { StreakService } from './streak.service';
import { CLOCK, SYSTEM_CLOCK } from './clock';

/**
 * Owns the streak recorder in isolation so the existing recorder modules
 * (Puzzles, Repertoire, Endgames) can import it and call
 * {@link StreakService.recordActivity} WITHOUT creating an import cycle.
 *
 * `StreakService` depends only on Prisma (global) and the injected {@link CLOCK}
 * — it pulls in none of the training/insights services — so importing this
 * module into a recorder module is acyclic. The full hub (TrainingModule) also
 * imports it for `get`/`setDailyGoal`. Prisma comes from the global
 * `DatabaseModule`.
 */
@Module({
  providers: [StreakService, { provide: CLOCK, useValue: SYSTEM_CLOCK }],
  exports: [StreakService],
})
export class StreakModule {}

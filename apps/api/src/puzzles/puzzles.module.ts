import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PuzzlesController } from './puzzles.controller';
import { PuzzlesService } from './puzzles.service';
import { PuzzleCatalogService } from './puzzle-catalog.service';
import { PuzzleServingService } from './puzzle-serving.service';
import { PuzzleRatingService } from './puzzle-rating.service';
import { PuzzleTrainingController } from './puzzle-training.controller';
import { PuzzleRushController } from './puzzle-rush.controller';
import { PuzzleRushService } from './puzzle-rush.service';

@Module({
  imports: [AuthModule],
  controllers: [PuzzlesController, PuzzleTrainingController, PuzzleRushController],
  providers: [
    PuzzlesService,
    PuzzleCatalogService,
    PuzzleServingService,
    PuzzleRatingService,
    PuzzleRushService,
  ],
  exports: [PuzzleCatalogService, PuzzleServingService, PuzzleRatingService, PuzzleRushService],
})
export class PuzzlesModule {}

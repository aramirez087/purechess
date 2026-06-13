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
import { PuzzleReviewController } from './puzzle-review.controller';
import { PuzzleReviewService } from './puzzle-review.service';

@Module({
  imports: [AuthModule],
  controllers: [
    PuzzlesController,
    PuzzleTrainingController,
    PuzzleRushController,
    PuzzleReviewController,
  ],
  providers: [
    PuzzlesService,
    PuzzleCatalogService,
    PuzzleServingService,
    PuzzleRatingService,
    PuzzleRushService,
    PuzzleReviewService,
  ],
  exports: [
    PuzzleCatalogService,
    PuzzleServingService,
    PuzzleRatingService,
    PuzzleRushService,
    PuzzleReviewService,
  ],
})
export class PuzzlesModule {}

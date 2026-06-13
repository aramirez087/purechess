import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PuzzlesController } from './puzzles.controller';
import { PuzzlesService } from './puzzles.service';
import { PuzzleCatalogService } from './puzzle-catalog.service';
import { PuzzleServingService } from './puzzle-serving.service';
import { PuzzleRatingService } from './puzzle-rating.service';
import { PuzzleHistoryService } from './puzzle-history.service';
import { PuzzleTrainingController } from './puzzle-training.controller';
import { PuzzleRushController } from './puzzle-rush.controller';
import { PuzzleRushService } from './puzzle-rush.service';
import { PuzzleReviewController } from './puzzle-review.controller';
import { PuzzleReviewService } from './puzzle-review.service';
import { GameMistakeController } from './game-mistake.controller';
import { GameMistakeService } from './game-mistake.service';

@Module({
  imports: [AuthModule],
  controllers: [
    PuzzlesController,
    PuzzleTrainingController,
    PuzzleRushController,
    PuzzleReviewController,
    GameMistakeController,
  ],
  providers: [
    PuzzlesService,
    PuzzleCatalogService,
    PuzzleServingService,
    PuzzleRatingService,
    PuzzleHistoryService,
    PuzzleRushService,
    PuzzleReviewService,
    GameMistakeService,
  ],
  exports: [
    PuzzleCatalogService,
    PuzzleServingService,
    PuzzleRatingService,
    PuzzleHistoryService,
    PuzzleRushService,
    PuzzleReviewService,
    GameMistakeService,
  ],
})
export class PuzzlesModule {}

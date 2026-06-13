import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PuzzlesController } from './puzzles.controller';
import { PuzzlesService } from './puzzles.service';
import { PuzzleCatalogService } from './puzzle-catalog.service';
import { PuzzleServingService } from './puzzle-serving.service';
import { PuzzleRatingService } from './puzzle-rating.service';
import { PuzzleTrainingController } from './puzzle-training.controller';

@Module({
  imports: [AuthModule],
  controllers: [PuzzlesController, PuzzleTrainingController],
  providers: [
    PuzzlesService,
    PuzzleCatalogService,
    PuzzleServingService,
    PuzzleRatingService,
  ],
  exports: [PuzzleCatalogService, PuzzleServingService, PuzzleRatingService],
})
export class PuzzlesModule {}

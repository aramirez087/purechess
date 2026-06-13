import { Module } from '@nestjs/common';
import { PuzzlesController } from './puzzles.controller';
import { PuzzlesService } from './puzzles.service';
import { PuzzleCatalogService } from './puzzle-catalog.service';

@Module({
  controllers: [PuzzlesController],
  providers: [PuzzlesService, PuzzleCatalogService],
  exports: [PuzzleCatalogService],
})
export class PuzzlesModule {}

import { Controller, Get } from '@nestjs/common';
import { PuzzlesService } from './puzzles.service';
import type { LichessPuzzleData } from './puzzles.types';

// Public — the daily puzzle needs no auth guard.
@Controller('puzzles')
export class PuzzlesController {
  constructor(private readonly puzzlesService: PuzzlesService) {}

  @Get('daily')
  getDaily(): Promise<LichessPuzzleData> {
    return this.puzzlesService.getDailyPuzzle();
  }
}

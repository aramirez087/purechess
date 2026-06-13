import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import type { PuzzleSource } from '@purechess/shared';

/**
 * Body for `POST /puzzles/:id/attempt`. The client reports only the outcome —
 * never a rating. `solved` and `msToSolve` are observed facts; `source` records
 * which surface served the puzzle (theme trainer, daily, rush, review, mistake).
 */
export class RecordAttemptDto {
  @IsBoolean()
  declare solved: boolean;

  /** Wall-clock time to solve, ms. Omitted when not measured. */
  @IsOptional()
  @IsInt()
  @Min(0)
  declare msToSolve?: number;

  @IsOptional()
  @IsEnum(['theme', 'daily', 'rush', 'review', 'mistake'])
  declare source?: PuzzleSource;
}

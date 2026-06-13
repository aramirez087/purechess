import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import type { RushMode } from '@purechess/shared';

const RUSH_MODES: RushMode[] = ['3min', '5strikes'];

/** Body for `POST /puzzles/rush/start`. Mode defaults to `3min` server-side. */
export class RushStartDto {
  @IsOptional()
  @IsEnum(RUSH_MODES)
  declare mode?: RushMode;
}

/**
 * Body for `POST /puzzles/rush/finish`. The client reports the run outcome
 * (score, duration) — the server owns the personal best. Score is clamped
 * server-side; we still validate it as a non-negative int here.
 */
export class RushFinishDto {
  @IsOptional()
  @IsEnum(RUSH_MODES)
  declare mode?: RushMode;

  @IsInt()
  @Min(0)
  declare score: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  declare durationMs?: number;
}

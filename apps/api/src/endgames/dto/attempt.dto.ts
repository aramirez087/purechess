import { IsBoolean, IsInt, Min } from 'class-validator';

/**
 * Body for `POST /endgames/:slug/attempt`. The client reports only the outcome
 * — whether it reached the objective and how many of its own moves it played.
 */
export class RecordEndgameAttemptDto {
  @IsBoolean()
  declare succeeded: boolean;

  @IsInt()
  @Min(0)
  declare movesPlayed: number;
}

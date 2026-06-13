import { IsInt, Max, Min } from 'class-validator';

/**
 * Body for `POST /train/goal`. The user picks their daily puzzle target; the
 * server clamps it (1..50) and persists it on `TrainingStreak.dailyGoalPuzzles`.
 */
export class SetGoalBodyDto {
  @IsInt()
  @Min(1)
  @Max(50)
  declare dailyGoalPuzzles: number;
}

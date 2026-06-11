import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import type { MatchmakingCategory } from '@purechess/shared';

export class JoinMatchmakingDto {
  @IsInt()
  @Min(1)
  declare timeControlSeconds: number;

  @IsInt()
  @Min(0)
  declare incrementSeconds: number;

  @IsEnum(['bullet', 'blitz', 'rapid'])
  declare category: MatchmakingCategory;

  /** Quick match is a ladder feature — omitted means rated. */
  @IsOptional()
  @IsBoolean()
  declare rated?: boolean;
}

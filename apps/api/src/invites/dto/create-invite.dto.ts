import { IsEnum, IsInt, Min } from 'class-validator';

export type TimeControlCategory = 'bullet' | 'blitz' | 'rapid';

export class CreateInviteDto {
  @IsInt()
  @Min(1)
  declare timeControlSeconds: number;

  @IsInt()
  @Min(0)
  declare incrementSeconds: number;

  @IsEnum(['bullet', 'blitz', 'rapid'])
  declare category: TimeControlCategory;
}

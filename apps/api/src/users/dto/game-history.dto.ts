import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { TimeControlCategory } from '@prisma/client';

export class GameHistoryQueryDto {
  @IsOptional()
  @IsEnum(TimeControlCategory)
  category?: TimeControlCategory;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  isRated?: boolean;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(String(value), 10) : 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

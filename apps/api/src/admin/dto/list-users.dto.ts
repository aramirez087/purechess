import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListUsersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  disabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

import { IsBoolean, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import type { GradeLabDrillDto, RepertoireColorDto } from '@purechess/shared';

export class GradeLabDrillBodyDto implements GradeLabDrillDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  declare family: string;

  @IsString()
  @MinLength(10)
  @MaxLength(120)
  declare epd: string;

  @IsEnum(['white', 'black'])
  declare color: RepertoireColorDto;

  @IsBoolean()
  declare correctFirstTry: boolean;
}
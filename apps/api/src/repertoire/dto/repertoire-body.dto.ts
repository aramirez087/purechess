import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type {
  CreateRepertoireDto,
  ImportRepertoireDto,
  RepertoireColorDto,
  RepertoireNodeDto,
  UpdateRepertoireDto,
} from '@purechess/shared';

/**
 * Request bodies for the repertoire controller. The tree is validated as a raw
 * `object` here (class-validator can't express the recursive node shape) —
 * `RepertoireService` runs the real structural + chess-legality validation via
 * `repertoire-tree.ts`. `name`/`color` get the cheap surface checks.
 */
export class CreateRepertoireBodyDto implements CreateRepertoireDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  declare name: string;

  @IsEnum(['white', 'black'])
  declare color: RepertoireColorDto;

  @IsObject()
  declare tree: RepertoireNodeDto;
}

export class UpdateRepertoireBodyDto implements UpdateRepertoireDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  declare name?: string;

  @IsOptional()
  @IsEnum(['white', 'black'])
  declare color?: RepertoireColorDto;

  @IsOptional()
  @IsObject()
  declare tree?: RepertoireNodeDto;
}

export class ImportRepertoireBodyDto implements ImportRepertoireDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  declare name: string;

  @IsEnum(['white', 'black'])
  declare color: RepertoireColorDto;

  @IsOptional()
  @IsObject()
  declare tree?: RepertoireNodeDto;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  declare pgn?: string;
}

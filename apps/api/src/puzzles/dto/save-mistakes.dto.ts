import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * One candidate mistake the client reports for `POST /games/:gameId/mistakes`.
 * Shapes the {@link MistakeCandidateDto} from `@purechess/shared`. The server
 * re-derives `fen`/`playedUci` from the persisted game and only keeps the
 * user's own over-threshold moves — these fields are claims, not truth.
 */
export class MistakeCandidateInput {
  @IsInt()
  @Min(1)
  declare ply: number;

  @IsString()
  declare fen: string;

  @IsString()
  declare playedUci: string;

  @IsString()
  declare bestUci: string;

  @IsArray()
  @IsString({ each: true })
  declare bestLineUci: string[];

  @IsInt()
  @Min(0)
  declare cpLoss: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  declare themeGuess?: string[];
}

/** Body for `POST /games/:gameId/mistakes`. Capped so a runaway client can't flood. */
export class SaveMistakesDto {
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MistakeCandidateInput)
  declare mistakes: MistakeCandidateInput[];
}

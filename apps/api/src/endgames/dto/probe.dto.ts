import { IsString, MinLength } from 'class-validator';

/** Body for `POST /endgames/:slug/probe` — the FEN to probe. */
export class ProbeFenDto {
  @IsString()
  @MinLength(1)
  declare fen: string;
}

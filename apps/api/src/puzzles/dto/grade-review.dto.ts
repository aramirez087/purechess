import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Body for `POST /puzzles/review/:id/grade`. The client reports only the
 * outcome — never a schedule. `solved` and `msToSolve` map to an SM-2 grade
 * server-side; the server owns the resulting interval/due date.
 */
export class GradeReviewDto {
  @IsBoolean()
  declare solved: boolean;

  /** Wall-clock time to solve, ms. A fast solve grades `easy`. */
  @IsOptional()
  @IsInt()
  @Min(0)
  declare msToSolve?: number;
}

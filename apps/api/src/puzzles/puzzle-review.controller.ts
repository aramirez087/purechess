import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { ReviewDueDto, ReviewGradeResultDto } from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PuzzleReviewService } from './puzzle-review.service';
import { GradeReviewDto } from './dto/grade-review.dto';

/**
 * Spaced-repetition review endpoints — the due-today queue and grading over the
 * `PuzzleReview` table. Registered additively in `PuzzlesModule` (its own
 * controller file; only the module registration line is the shared Wave-3
 * seam). Every route is auth-gated and scoped to the current user
 * (cookie `purechess_session`).
 */
@Controller('puzzles/review')
export class PuzzleReviewController {
  constructor(private readonly review: PuzzleReviewService) {}

  /** The user's due-today queue (oldest-first) + the total due count. */
  @Get('due')
  @UseGuards(SessionAuthGuard)
  getDue(@CurrentUser() user: User): Promise<ReviewDueDto> {
    return this.review.getDuePayload(user.id);
  }

  /** Grade a reviewed card and return its next due info (or graduation). */
  @Post(':id/grade')
  @UseGuards(SessionAuthGuard)
  @HttpCode(200)
  grade(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: GradeReviewDto,
  ): Promise<ReviewGradeResultDto> {
    return this.review.grade(user.id, id, dto.solved, dto.msToSolve);
  }
}

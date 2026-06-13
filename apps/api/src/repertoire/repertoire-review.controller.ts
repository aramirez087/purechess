import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { DrillLinesDto, GradeDrillResultDto } from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RepertoireReviewService } from './repertoire-review.service';
import { GradeDrillBodyDto } from './dto/repertoire-body.dto';

/**
 * Opening trainer endpoints — drill the user's repertoire lines and grade them
 * into the spaced-repetition queue. Auth-gated and ownership-scoped: the
 * service raises 404 for a missing OR non-owned repertoire, so user A can never
 * drill or grade user B's lines.
 *
 * Registered ADDITIVELY in `RepertoireModule` alongside the S08 CRUD
 * `RepertoireController` — both are `@Controller('repertoire')`, distinct paths.
 */
@Controller('repertoire')
@UseGuards(SessionAuthGuard)
export class RepertoireReviewController {
  constructor(private readonly service: RepertoireReviewService) {}

  /** The lines to drill this session (due leaves first, then a few new). */
  @Get(':id/drill')
  drill(@CurrentUser() user: User, @Param('id') id: string): Promise<DrillLinesDto> {
    return this.service.getDrillLines(user.id, id);
  }

  /** Grade a drilled line and reschedule it via the shared SM-2 scheduler. */
  @Post(':id/grade')
  grade(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: GradeDrillBodyDto,
  ): Promise<GradeDrillResultDto> {
    return this.service.grade(user.id, id, dto.nodePath, dto.correctFirstTry);
  }
}

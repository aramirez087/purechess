import { Controller, Get, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { InsightDto } from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InsightsService } from './insights.service';

/**
 * Insights — the "what should I work on?" surface. One auth-gated route returns
 * the user's evidence-backed, ranked weakness list (each item deep-links to the
 * drill that fixes it). The result is cached per user; this controller just
 * scopes it to the signed-in user.
 */
@Controller('train')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  /** The user's ranked weaknesses + headline recommendation. */
  @Get('insights')
  @UseGuards(SessionAuthGuard)
  getInsights(@CurrentUser() user: User): Promise<InsightDto> {
    return this.insights.getInsights(user.id);
  }
}

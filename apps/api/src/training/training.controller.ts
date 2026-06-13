import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { TrainingPlanDto, TrainingStreakDto } from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TrainingService } from './training.service';
import { StreakService } from './streak.service';
import { SetGoalBodyDto } from './dto/set-goal.dto';

/**
 * The training hub's API — the front door to "get better today". All routes are
 * auth-gated and scoped to the signed-in user:
 *   - `GET /train/plan`   → today's ~10-minute, weakness-targeted plan
 *   - `GET /train/streak` → the streak snapshot + recent-day calendar
 *   - `POST /train/goal`  → set the daily puzzle goal
 *
 * The cross-cutting weakness list lives on the sibling `/train/insights`
 * (InsightsController). Both share the `/train` prefix; keep them separate
 * controllers so the hub plan logic and the insights engine stay decoupled.
 */
@Controller('train')
export class TrainingController {
  constructor(
    private readonly training: TrainingService,
    private readonly streaks: StreakService,
  ) {}

  /** Today's ordered ~10-minute plan with live done/target progress. */
  @Get('plan')
  @UseGuards(SessionAuthGuard)
  getPlan(@CurrentUser() user: User): Promise<TrainingPlanDto> {
    return this.training.getPlan(user.id);
  }

  /** The user's streak snapshot + recent training days for the calendar. */
  @Get('streak')
  @UseGuards(SessionAuthGuard)
  getStreak(@CurrentUser() user: User): Promise<TrainingStreakDto> {
    return this.streaks.get(user.id);
  }

  /** Set the daily puzzle goal (clamped 1..50 server-side). */
  @Post('goal')
  @UseGuards(SessionAuthGuard)
  @HttpCode(200)
  setGoal(
    @CurrentUser() user: User,
    @Body() dto: SetGoalBodyDto,
  ): Promise<TrainingStreakDto> {
    return this.streaks.setDailyGoal(user.id, dto.dailyGoalPuzzles);
  }
}

import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { GradeDrillResultDto, LabDrillLinesDto, RepertoireColorDto } from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OpeningLabReviewService } from './opening-lab-review.service';
import { GradeLabDrillBodyDto } from './dto/opening-lab-body.dto';

@Controller('opening-lab')
@UseGuards(SessionAuthGuard)
export class OpeningLabController {
  constructor(private readonly service: OpeningLabReviewService) {}

  @Get('drill')
  drill(
    @CurrentUser() user: User,
    @Query('family') family: string,
    @Query('color') color: RepertoireColorDto = 'white',
  ): Promise<LabDrillLinesDto> {
    return this.service.getDrillLines(user.id, family ?? '', color);
  }

  @Post('grade')
  grade(
    @CurrentUser() user: User,
    @Body() dto: GradeLabDrillBodyDto,
  ): Promise<GradeDrillResultDto> {
    return this.service.grade(
      user.id,
      dto.family,
      dto.epd,
      dto.color,
      dto.correctFirstTry,
    );
  }
}
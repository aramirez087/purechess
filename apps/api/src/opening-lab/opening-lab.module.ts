import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StreakModule } from '../training/streak.module';
import { OpeningLabController } from './opening-lab.controller';
import { OpeningLabReviewService } from './opening-lab-review.service';

@Module({
  imports: [AuthModule, StreakModule],
  controllers: [OpeningLabController],
  providers: [OpeningLabReviewService],
  exports: [OpeningLabReviewService],
})
export class OpeningLabModule {}
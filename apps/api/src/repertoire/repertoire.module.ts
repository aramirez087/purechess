import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RepertoireController } from './repertoire.controller';
import { RepertoireService } from './repertoire.service';
import { RepertoireReviewController } from './repertoire-review.controller';
import { RepertoireReviewService } from './repertoire-review.service';

/**
 * Opening repertoires (CRUD + import) plus the opening trainer (drill + grade).
 * `AuthModule` supplies `SessionAuthGuard` + `SessionsService`; Prisma comes
 * from the global `DatabaseModule`. `RepertoireReviewService` is exported so
 * the S13 hub can inject it for the due-line badge.
 */
@Module({
  imports: [AuthModule],
  controllers: [RepertoireController, RepertoireReviewController],
  providers: [RepertoireService, RepertoireReviewService],
  exports: [RepertoireService, RepertoireReviewService],
})
export class RepertoireModule {}

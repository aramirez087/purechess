import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RepertoireController } from './repertoire.controller';
import { RepertoireService } from './repertoire.service';

/**
 * Opening repertoires (CRUD + import). `AuthModule` supplies `SessionAuthGuard`
 * + `SessionsService`; Prisma comes from the global `DatabaseModule`.
 */
@Module({
  imports: [AuthModule],
  controllers: [RepertoireController],
  providers: [RepertoireService],
  exports: [RepertoireService],
})
export class RepertoireModule {}

import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsAdminController } from './reports-admin.controller';
import { ReportsService } from './reports.service';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AdminModule, AuthModule],
  controllers: [ReportsController, ReportsAdminController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}

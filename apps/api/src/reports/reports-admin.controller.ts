import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListReportsDto } from './dto/list-reports.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import type { User } from '@prisma/client';

@Controller('admin/reports')
@UseGuards(SessionAuthGuard, AdminGuard)
export class ReportsAdminController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  listReports(@Query() dto: ListReportsDto) {
    return this.reportsService.listAdminReports(dto);
  }

  @Get(':id')
  getReport(@Param('id') id: string) {
    return this.reportsService.getAdminReport(id);
  }

  @Patch(':id')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
    @CurrentUser() admin: User,
  ) {
    return this.reportsService.updateReportStatus(admin.id, id, dto);
  }
}

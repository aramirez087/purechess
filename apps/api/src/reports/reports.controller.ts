import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateReportDto } from './dto/create-report.dto';
import type { User } from '@prisma/client';

@Controller('reports')
@UseGuards(SessionAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  createReport(@CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.reportsService.createReport(user.id, dto);
  }

  @Get('me')
  myReports(@CurrentUser() user: User) {
    return this.reportsService.myReports(user.id);
  }
}

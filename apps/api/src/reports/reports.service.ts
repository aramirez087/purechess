import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../admin/audit.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ListReportsDto } from './dto/list-reports.dto';

const PLAYER_SELECT = { select: { id: true, username: true } };
const GAME_SELECT = { select: { id: true, category: true, status: true } };

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createReport(reporterUserId: string, dto: CreateReportDto) {
    if (reporterUserId === dto.reportedUserId) {
      throw new BadRequestException('Cannot report yourself');
    }

    const existing = await this.prisma.report.findFirst({
      where: { reporterUserId, gameId: dto.gameId ?? null },
    });
    if (existing) return { created: false, report: existing };

    const report = await this.prisma.report.create({
      data: {
        reporterUserId,
        reportedUserId: dto.reportedUserId,
        gameId: dto.gameId ?? null,
        reason: dto.reason,
        notes: dto.notes,
      },
    });
    return { created: true, report };
  }

  async myReports(userId: string) {
    return this.prisma.report.findMany({
      where: { reporterUserId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        reported: PLAYER_SELECT,
        game: GAME_SELECT,
      },
    });
  }

  async listAdminReports(dto: ListReportsDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ReportWhereInput = {};
    if (dto.status) where.status = dto.status as ReportStatus;
    if (dto.reportedUserId) where.reportedUserId = dto.reportedUserId;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: PLAYER_SELECT,
          reported: PLAYER_SELECT,
          reviewedBy: PLAYER_SELECT,
          game: GAME_SELECT,
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    const relatedCounts = await Promise.all(
      (reports as Array<{ reportedUserId: string; gameId: string | null }>).map((r) =>
        this.prisma.report.count({
          where: { reportedUserId: r.reportedUserId, gameId: r.gameId },
        }),
      ),
    );

    const items = (reports as object[]).map((r, i: number) => ({ ...r, relatedCount: relatedCounts[i] }));
    return { reports: items, page, pageSize, total };
  }

  async getAdminReport(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        reporter: PLAYER_SELECT,
        reported: PLAYER_SELECT,
        reviewedBy: PLAYER_SELECT,
        game: { select: { id: true, category: true, status: true, result: true, resultReason: true, whitePlayer: PLAYER_SELECT, blackPlayer: PLAYER_SELECT } },
      },
    });
    if (!report) throw new NotFoundException('Report not found');

    const [whiteGames, blackGames, reportedUserSignals, relatedCount] = await Promise.all([
      report.game
        ? this.prisma.game.findMany({
            where: { whiteUserId: report.reportedUserId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { id: true, category: true, status: true, result: true, createdAt: true, blackPlayer: PLAYER_SELECT },
          })
        : Promise.resolve([]),
      report.game
        ? this.prisma.game.findMany({
            where: { blackUserId: report.reportedUserId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { id: true, category: true, status: true, result: true, createdAt: true, whitePlayer: PLAYER_SELECT },
          })
        : Promise.resolve([]),
      this.prisma.fairPlaySignal.findMany({
        where: { userId: report.reportedUserId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count({
        where: { reportedUserId: report.reportedUserId, gameId: report.gameId },
      }),
    ]);

    const reportedUserRecentGames = [...whiteGames, ...blackGames]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    return { ...report, relatedCount, reportedUserSignals, reportedUserRecentGames };
  }

  async updateReportStatus(adminUserId: string, id: string, dto: UpdateReportStatusDto) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    const data: Prisma.ReportUncheckedUpdateInput = {
      status: dto.status as ReportStatus,
      reviewedAt: new Date(),
      reviewedByUserId: adminUserId,
    };
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.report.update({ where: { id }, data });

    await this.audit.log(adminUserId, 'update_report_status', 'Report', id, {
      status: dto.status,
      notes: dto.notes ?? null,
    });

    return updated;
  }
}

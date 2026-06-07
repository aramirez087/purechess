import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportsService } from '../../src/reports/reports.service';
import { AuditService } from '../../src/admin/audit.service';
import { PrismaService } from '../../src/database/prisma.service';

const mockPrisma = {
  report: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  game: { findMany: jest.fn() },
  fairPlaySignal: { findMany: jest.fn() },
};

const mockAudit = { log: jest.fn() };

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('createReport', () => {
    it('throws BadRequestException on self-report', async () => {
      await expect(
        service.createReport('u1', { reportedUserId: 'u1', reason: 'cheating' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns existing report as no-op on duplicate', async () => {
      const existing = { id: 'r1', reporterUserId: 'u1', reportedUserId: 'u2' };
      mockPrisma.report.findFirst.mockResolvedValue(existing);

      const result = await service.createReport('u1', {
        reportedUserId: 'u2',
        gameId: 'g1',
        reason: 'cheating',
      });

      expect(result).toEqual({ created: false, report: existing });
      expect(mockPrisma.report.create).not.toHaveBeenCalled();
    });

    it('creates a new report', async () => {
      const created = { id: 'r2', reporterUserId: 'u1', reportedUserId: 'u2' };
      mockPrisma.report.findFirst.mockResolvedValue(null);
      mockPrisma.report.create.mockResolvedValue(created);

      const result = await service.createReport('u1', {
        reportedUserId: 'u2',
        gameId: 'g1',
        reason: 'abuse',
        notes: 'test',
      });

      expect(result).toEqual({ created: true, report: created });
      expect(mockPrisma.report.create).toHaveBeenCalled();
    });
  });

  describe('updateReportStatus', () => {
    it('throws NotFoundException when report missing', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null);
      await expect(
        service.updateReportStatus('admin1', 'missing', { status: 'reviewed' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('transitions to reviewed and calls audit log', async () => {
      const report = { id: 'r1' };
      const updated = { id: 'r1', status: 'reviewed' };
      mockPrisma.report.findUnique.mockResolvedValue(report);
      mockPrisma.report.update.mockResolvedValue(updated);

      const result = await service.updateReportStatus('admin1', 'r1', { status: 'reviewed' });

      expect(result.status).toBe('reviewed');
      expect(mockAudit.log).toHaveBeenCalledWith(
        'admin1',
        'update_report_status',
        'Report',
        'r1',
        expect.objectContaining({ status: 'reviewed' }),
      );
    });

    it('transitions to dismissed and calls audit log', async () => {
      const report = { id: 'r1' };
      const updated = { id: 'r1', status: 'dismissed' };
      mockPrisma.report.findUnique.mockResolvedValue(report);
      mockPrisma.report.update.mockResolvedValue(updated);

      await service.updateReportStatus('admin1', 'r1', { status: 'dismissed', notes: 'not valid' });

      expect(mockAudit.log).toHaveBeenCalledWith(
        'admin1',
        'update_report_status',
        'Report',
        'r1',
        { status: 'dismissed', notes: 'not valid' },
      );
    });
  });

  describe('getAdminReport', () => {
    it('throws NotFoundException when report missing', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null);
      await expect(service.getAdminReport('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns report with signals and recent games', async () => {
      const report = {
        id: 'r1',
        reportedUserId: 'u2',
        game: { id: 'g1' },
      };
      mockPrisma.report.findUnique.mockResolvedValue(report);
      mockPrisma.game.findMany.mockResolvedValue([]);
      mockPrisma.fairPlaySignal.findMany.mockResolvedValue([]);
      mockPrisma.report.count.mockResolvedValue(1);

      const result = await service.getAdminReport('r1');

      expect(result.id).toBe('r1');
      expect(result.reportedUserSignals).toEqual([]);
      expect(result.reportedUserRecentGames).toEqual([]);
      expect(result.relatedCount).toBe(1);
    });
  });
});

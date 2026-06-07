import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ReportsAdminController } from '../../src/reports/reports-admin.controller';
import { ReportsService } from '../../src/reports/reports.service';
import { SessionAuthGuard } from '../../src/auth/guards/session-auth.guard';
import { AdminGuard } from '../../src/auth/guards/admin.guard';
import type { User } from '@prisma/client';

const mockService = {
  listAdminReports: jest.fn(),
  getAdminReport: jest.fn(),
  updateReportStatus: jest.fn(),
};

const adminUser = { id: 'admin1', isAdmin: true } as User;

describe('ReportsAdminController', () => {
  let controller: ReportsAdminController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsAdminController],
      providers: [{ provide: ReportsService, useValue: mockService }],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReportsAdminController>(ReportsAdminController);
  });

  describe('AdminGuard unit', () => {
    it('allows admin users', () => {
      const guard = new AdminGuard();
      const ctx = {
        switchToHttp: () => ({ getRequest: () => ({ user: { isAdmin: true } }) }),
      } as never;
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('throws ForbiddenException for non-admin', () => {
      const guard = new AdminGuard();
      const ctx = {
        switchToHttp: () => ({ getRequest: () => ({ user: { isAdmin: false } }) }),
      } as never;
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('listReports', () => {
    it('delegates to service', async () => {
      const result = { reports: [], page: 1, pageSize: 20, total: 0 };
      mockService.listAdminReports.mockResolvedValue(result);

      const res = await controller.listReports({ status: 'open' });
      expect(res).toEqual(result);
      expect(mockService.listAdminReports).toHaveBeenCalledWith({ status: 'open' });
    });
  });

  describe('getReport', () => {
    it('delegates to service', async () => {
      const report = { id: 'r1' };
      mockService.getAdminReport.mockResolvedValue(report);

      const res = await controller.getReport('r1');
      expect(res).toEqual(report);
    });
  });

  describe('updateStatus', () => {
    it('delegates to service with admin id', async () => {
      const updated = { id: 'r1', status: 'reviewed' };
      mockService.updateReportStatus.mockResolvedValue(updated);

      const res = await controller.updateStatus('r1', { status: 'reviewed' }, adminUser);
      expect(res).toEqual(updated);
      expect(mockService.updateReportStatus).toHaveBeenCalledWith('admin1', 'r1', { status: 'reviewed' });
    });
  });
});

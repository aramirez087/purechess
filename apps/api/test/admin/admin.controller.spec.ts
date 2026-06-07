import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AdminController } from '../../src/admin/admin.controller';
import { AdminService } from '../../src/admin/admin.service';
import { AuditService } from '../../src/admin/audit.service';
import { SessionAuthGuard } from '../../src/auth/guards/session-auth.guard';
import { AdminGuard } from '../../src/auth/guards/admin.guard';

const mockAdminService = {
  listUsers: jest.fn(),
  getUser: jest.fn(),
  disableUser: jest.fn(),
  enableUser: jest.fn(),
  listGames: jest.fn(),
  getGame: jest.fn(),
  getQueues: jest.fn(),
  getActiveGames: jest.fn(),
  listAudit: jest.fn(),
};

const mockAuditService = { log: jest.fn() };

const adminUser = { id: 'admin1', isAdmin: true };
const regularUser = { id: 'user1', isAdmin: false };

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('listUsers delegates to service', async () => {
    mockAdminService.listUsers.mockResolvedValue({ users: [], page: 1, pageSize: 20, total: 0 });
    const result = await controller.listUsers({ page: 1, pageSize: 20 });
    expect(mockAdminService.listUsers).toHaveBeenCalled();
    expect(result.total).toBe(0);
  });

  it('getUser delegates to service', async () => {
    mockAdminService.getUser.mockResolvedValue({ id: 'u1' });
    const result = await controller.getUser('u1');
    expect(result).toEqual({ id: 'u1' });
  });

  it('disableUser passes adminId and reason', async () => {
    mockAdminService.disableUser.mockResolvedValue({ ok: true });
    const result = await controller.disableUser('u2', { reason: 'cheating' }, adminUser as never);
    expect(mockAdminService.disableUser).toHaveBeenCalledWith('admin1', 'u2', 'cheating');
    expect(result).toEqual({ ok: true });
  });

  it('enableUser passes adminId', async () => {
    mockAdminService.enableUser.mockResolvedValue({ ok: true });
    await controller.enableUser('u2', adminUser as never);
    expect(mockAdminService.enableUser).toHaveBeenCalledWith('admin1', 'u2');
  });

  it('getQueues delegates', async () => {
    mockAdminService.getQueues.mockResolvedValue({ buckets: {} });
    const result = await controller.getQueues();
    expect(result).toEqual({ buckets: {} });
  });

  it('AdminGuard rejects non-admin', () => {
    const guard = new AdminGuard();
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: regularUser }) }),
    } as never;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('AdminGuard allows admin', () => {
    const guard = new AdminGuard();
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: adminUser }) }),
    } as never;
    expect(guard.canActivate(ctx)).toBe(true);
  });
});

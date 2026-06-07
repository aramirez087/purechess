import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from '../../src/admin/admin.service';
import { AuditService } from '../../src/admin/audit.service';
import { PrismaService } from '../../src/database/prisma.service';

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  session: { deleteMany: jest.fn() },
  game: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  adminAuditLog: { findMany: jest.fn(), count: jest.fn() },
};

const mockAudit = { log: jest.fn() };

const mockRedis = {
  publish: jest.fn(),
  keys: jest.fn().mockResolvedValue([]),
  zrangebyscore: jest.fn().mockResolvedValue([]),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('listUsers', () => {
    it('returns paginated users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.listUsers({ page: 1, pageSize: 20 });
      expect(result).toEqual({ users: [{ id: 'u1' }], page: 1, pageSize: 20, total: 1 });
    });

    it('filters by q and disabled', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.listUsers({ q: 'alice', disabled: true, page: 1, pageSize: 20 });

      const whereArg = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeDefined();
      expect(whereArg.isDisabled).toBe(true);
    });
  });

  describe('getUser', () => {
    it('throws NotFoundException when user missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUser('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns user with relations', async () => {
      const user = { id: 'u1', ratings: [], oauthAccounts: [], _count: {} };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      const result = await service.getUser('u1');
      expect(result).toEqual(user);
    });
  });

  describe('disableUser', () => {
    it('throws BadRequestException on self-disable', async () => {
      await expect(service.disableUser('u1', 'u1', 'test')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when user missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.disableUser('admin', 'missing', 'reason')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('disables user, deletes sessions, publishes redis, logs audit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.session.deleteMany.mockResolvedValue({});

      const result = await service.disableUser('admin', 'u1', 'cheating');

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { isDisabled: true } });
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(mockRedis.publish).toHaveBeenCalledWith('user-disabled', 'u1');
      expect(mockAudit.log).toHaveBeenCalledWith('admin', 'disable_user', 'User', 'u1', { reason: 'cheating' });
    });
  });

  describe('enableUser', () => {
    it('throws NotFoundException when user missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.enableUser('admin', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('enables user and logs audit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2' });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.enableUser('admin', 'u2');
      expect(result).toEqual({ ok: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: 'u2' }, data: { isDisabled: false } });
      expect(mockAudit.log).toHaveBeenCalledWith('admin', 'enable_user', 'User', 'u2', {});
    });
  });

  describe('listGames', () => {
    it('returns paginated games', async () => {
      mockPrisma.game.findMany.mockResolvedValue([{ id: 'g1' }]);
      mockPrisma.game.count.mockResolvedValue(1);

      const result = await service.listGames({ page: 1, pageSize: 20 });
      expect(result).toEqual({ games: [{ id: 'g1' }], page: 1, pageSize: 20, total: 1 });
    });
  });

  describe('getQueues', () => {
    it('returns empty buckets when no keys', async () => {
      mockRedis.keys.mockResolvedValue([]);
      const result = await service.getQueues();
      expect(result).toEqual({ buckets: {} });
    });
  });

  describe('listAudit', () => {
    it('returns paginated audit logs', async () => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue([{ id: 'a1' }]);
      mockPrisma.adminAuditLog.count.mockResolvedValue(1);

      const result = await service.listAudit({ page: 1, pageSize: 20 });
      expect(result).toEqual({ logs: [{ id: 'a1' }], page: 1, pageSize: 20, total: 1 });
    });
  });
});

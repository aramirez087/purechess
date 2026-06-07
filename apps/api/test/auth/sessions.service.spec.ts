import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionsService } from '../../src/auth/sessions.service';
import { PrismaService } from '../../src/database/prisma.service';

const mockPrisma = {
  session: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn().mockReturnValue('test-secret-32-chars-long-xxxxxxx'),
};

describe('SessionsService', () => {
  let service: SessionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<SessionsService>(SessionsService);
  });

  describe('createSession', () => {
    it('returns token and expiresAt 30 days from now', async () => {
      mockPrisma.session.create.mockResolvedValue({});
      const before = Date.now();
      const result = await service.createSession('user-1');
      const after = Date.now();

      expect(result.token).toBeTruthy();
      expect(result.token.length).toBeGreaterThan(20);
      const ttl = result.expiresAt.getTime() - before;
      const ttlMax = result.expiresAt.getTime() - after;
      expect(ttl).toBeGreaterThanOrEqual(29 * 24 * 60 * 60 * 1000);
      expect(ttlMax).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000 + 1000);

      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1' }) }),
      );
    });
  });

  describe('lookupSession', () => {
    it('returns session and user for valid token', async () => {
      const futureExpiry = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
      const fakeUser = { id: 'user-1', isDisabled: false };
      mockPrisma.session.findUnique.mockResolvedValue({ id: 'hash', expiresAt: futureExpiry, user: fakeUser });

      const { token } = await (() => {
        mockPrisma.session.create.mockResolvedValue({});
        return service.createSession('user-1');
      })();

      mockPrisma.session.findUnique.mockResolvedValue({ id: 'hash', expiresAt: futureExpiry, user: fakeUser });
      const result = await service.lookupSession(token);

      expect(result).not.toBeNull();
      expect(result!.user.id).toBe('user-1');
    });

    it('returns null for expired session', async () => {
      const pastExpiry = new Date(Date.now() - 1000);
      mockPrisma.session.findUnique.mockResolvedValue({ id: 'hash', expiresAt: pastExpiry, user: { isDisabled: false } });
      mockPrisma.session.create.mockResolvedValue({});
      const { token } = await service.createSession('user-1');

      const result = await service.lookupSession(token);
      expect(result).toBeNull();
    });

    it('returns null for tampered token (HMAC mismatch)', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);
      const result = await service.lookupSession('tampered-token-xyz');
      expect(result).toBeNull();
    });

    it('extends session when near expiry (sliding window)', async () => {
      const nearExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const fakeUser = { id: 'user-1', isDisabled: false };
      mockPrisma.session.findUnique.mockResolvedValue({ id: 'hash', expiresAt: nearExpiry, user: fakeUser });
      mockPrisma.session.update.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      const { token } = await service.createSession('user-1');
      await service.lookupSession(token);

      expect(mockPrisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ expiresAt: expect.any(Date) }) }),
      );
    });
  });

  describe('revokeSession', () => {
    it('deletes session by HMAC id', async () => {
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.session.create.mockResolvedValue({});
      const { token } = await service.createSession('user-1');

      await service.revokeSession(token);
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: expect.any(String) }) }),
      );
    });
  });
});

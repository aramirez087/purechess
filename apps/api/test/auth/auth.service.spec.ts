import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../src/auth/auth.service';
import { PasswordService } from '../../src/auth/password.service';
import { SessionsService } from '../../src/auth/sessions.service';
import { PrismaService } from '../../src/database/prisma.service';

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  passwordResetToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  oAuthAccount: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockPasswords = {
  hashPassword: jest.fn().mockResolvedValue('$argon2id$hash'),
  verifyPassword: jest.fn().mockResolvedValue(true),
};

const mockSessions = {
  createSession: jest.fn().mockResolvedValue({ token: 'tok', expiresAt: FUTURE }),
  revokeSession: jest.fn().mockResolvedValue(undefined),
};

const mockConfig = {
  get: jest.fn().mockReturnValue('development'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSessions.createSession.mockResolvedValue({ token: 'tok', expiresAt: FUTURE });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PasswordService, useValue: mockPasswords },
        { provide: SessionsService, useValue: mockSessions },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  const baseUser = {
    id: 'u1',
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: '$argon2id$hash',
    avatarUrl: null,
    isAdmin: false,
    isDisabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('register', () => {
    it('success — returns SafeUser and session', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(baseUser);

      const result = await service.register({ email: 'test@example.com', username: 'testuser', password: 'Test1234!' });

      expect(result.user.id).toBe('u1');
      expect(result.user.username).toBe('testuser');
      expect(result.sessionToken).toBe('tok');
      expect(mockPasswords.hashPassword).toHaveBeenCalledWith('Test1234!');
      expect(mockSessions.createSession).toHaveBeenCalledWith('u1', undefined, undefined);
    });

    it('throws ConflictException for duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(baseUser);
      await expect(service.register({ email: 'test@example.com', username: 'other', password: 'Test1234!' }))
        .rejects.toThrow(ConflictException);
    });

    it('throws ConflictException for duplicate username', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(baseUser);
      await expect(service.register({ email: 'new@example.com', username: 'testuser', password: 'Test1234!' }))
        .rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException for reserved username', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.register({ email: 'test@example.com', username: 'admin', password: 'Test1234!' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('success by email — returns session', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);
      mockPasswords.verifyPassword.mockResolvedValue(true);

      const result = await service.login({ emailOrUsername: 'test@example.com', password: 'Test1234!' });
      expect(result.user.id).toBe('u1');
      expect(result.sessionToken).toBe('tok');
    });

    it('success by username — returns session', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);
      mockPasswords.verifyPassword.mockResolvedValue(true);

      const result = await service.login({ emailOrUsername: 'testuser', password: 'Test1234!' });
      expect(result.user.id).toBe('u1');
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);
      mockPasswords.verifyPassword.mockResolvedValue(false);

      await expect(service.login({ emailOrUsername: 'test@example.com', password: 'Wrong!' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ emailOrUsername: 'unknown@example.com', password: 'Test1234!' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('requestPasswordReset', () => {
    it('returns void without error for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.requestPasswordReset('unknown@example.com')).resolves.toBeUndefined();
    });

    it('creates reset token for known email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      await service.requestPasswordReset('test@example.com');
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u1', tokenHash: expect.any(String) }),
        }),
      );
    });
  });

  describe('confirmPasswordReset', () => {
    it('updates password and marks token used', async () => {
      const resetToken = { id: 'rt1', userId: 'u1', tokenHash: 'hash', usedAt: null, expiresAt: FUTURE };
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(resetToken);
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.confirmPasswordReset('validtoken', 'NewPass1!');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws UnauthorizedException for invalid token', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);
      await expect(service.confirmPasswordReset('bad', 'NewPass1!')).rejects.toThrow(UnauthorizedException);
    });
  });
});

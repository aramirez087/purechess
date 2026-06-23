import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AuthService } from '../../src/auth/auth.service';
import { PasswordService } from '../../src/auth/password.service';
import { SessionsService } from '../../src/auth/sessions.service';
import { EmailService } from '../../src/email/email.service';
import { PrismaService } from '../../src/database/prisma.service';
import { PosthogService } from '../../src/analytics/posthog.service';

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
    updateMany: jest.fn(),
  },
  emailVerificationToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  oAuthAccount: {
    findUnique: jest.fn(),
  },
  session: {
    deleteMany: jest.fn(),
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
  get: jest.fn((key: string) => {
    if (key === 'NEXT_PUBLIC_APP_URL') return 'http://localhost:3000';
    if (key === 'WEB_URL') return 'http://localhost:3000';
    if (key === 'OAUTH_GOOGLE_CLIENT_ID') return 'google-id';
    if (key === 'OAUTH_APPLE_TEAM_ID') return '';
    return 'development';
  }),
};

const mockPosthog = { captureEvent: jest.fn(), captureException: jest.fn(), identify: jest.fn() };
const mockEmail = { send: jest.fn().mockResolvedValue(undefined) };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSessions.createSession.mockResolvedValue({ token: 'tok', expiresAt: FUTURE });
    mockPrisma.$transaction.mockImplementation((ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return Promise.resolve(ops);
    });
    mockPrisma.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.emailVerificationToken.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PasswordService, useValue: mockPasswords },
        { provide: SessionsService, useValue: mockSessions },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PosthogService, useValue: mockPosthog },
        { provide: EmailService, useValue: mockEmail },
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
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  describe('register', () => {
    it('success — returns SafeUser, sends verification email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(baseUser);

      const result = await service.register({ email: 'test@example.com', username: 'testuser', password: 'Test1234!' });

      expect(result.user.emailVerified).toBe(false);
      expect(mockEmail.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringContaining('Verify') }),
      );
    });

    it('throws ConflictException on Prisma P2002 race', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const err = new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '5.14.0',
      });
      mockPrisma.user.create.mockRejectedValue(err);

      await expect(service.register({ email: 'test@example.com', username: 'testuser', password: 'Test1234!' }))
        .rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException for reserved username', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.register({ email: 'test@example.com', username: 'admin', password: 'Test1234!' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmEmailVerification', () => {
    it('marks user verified', async () => {
      mockPrisma.emailVerificationToken.findFirst.mockResolvedValue({
        id: 'vt1',
        userId: 'u1',
        usedAt: null,
        expiresAt: FUTURE,
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.confirmEmailVerification('rawtoken');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('handleOAuth', () => {
    it('links OAuth to an existing email account', async () => {
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(baseUser)
        .mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({
        ...baseUser,
        emailVerifiedAt: new Date(),
      });

      const result = await service.handleOAuth('google', 'gid', 'test@example.com');
      expect(result.user.username).toBe('testuser');
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('creates a new user when email is unknown', async () => {
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        ...baseUser,
        username: 'test',
        emailVerifiedAt: new Date(),
      });

      const result = await service.handleOAuth('google', 'gid', 'test@example.com');
      expect(result.user.emailVerified).toBe(true);
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('throws when provider omits email', async () => {
      await expect(service.handleOAuth('google', 'gid', '')).rejects.toThrow(BadRequestException);
    });
  });
});
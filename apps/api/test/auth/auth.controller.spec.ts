import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { SessionAuthGuard } from '../../src/auth/guards/session-auth.guard';
import { OptionalSessionAuthGuard } from '../../src/auth/guards/optional-session-auth.guard';
import { SessionsService } from '../../src/auth/sessions.service';
import { AdminGuard } from '../../src/auth/guards/admin.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { PosthogService } from '../../src/analytics/posthog.service';

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

const safeUser = {
  id: 'u1',
  username: 'testuser',
  avatarUrl: null,
  isAdmin: false,
  createdAt: new Date(),
};

const mockUser = {
  id: 'u1',
  username: 'testuser',
  email: 'test@example.com',
  avatarUrl: null,
  isAdmin: false,
  isDisabled: false,
  createdAt: new Date(),
};

const mockAuthService = {
  register: jest.fn().mockResolvedValue({ user: safeUser, sessionToken: 'tok', sessionExpiresAt: FUTURE }),
  login: jest.fn().mockResolvedValue({ user: safeUser, sessionToken: 'tok', sessionExpiresAt: FUTURE }),
  logout: jest.fn().mockResolvedValue(undefined),
  requestPasswordReset: jest.fn().mockResolvedValue(undefined),
  confirmPasswordReset: jest.fn().mockResolvedValue(undefined),
  setCookie: jest.fn(),
  clearCookie: jest.fn(),
};

describe('AuthController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuthService.register.mockResolvedValue({ user: safeUser, sessionToken: 'tok', sessionExpiresAt: FUTURE });
    mockAuthService.login.mockResolvedValue({ user: safeUser, sessionToken: 'tok', sessionExpiresAt: FUTURE });

    const mockSessionsService = {
      lookupSession: jest.fn().mockImplementation((token: string) => {
        if (token === 'valid-session-token') {
          return Promise.resolve({ session: { id: 'sid' }, user: mockUser });
        }
        return Promise.resolve(null);
      }),
      revokeSession: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: SessionsService, useValue: mockSessionsService },
        { provide: PosthogService, useValue: { captureEvent: jest.fn(), captureException: jest.fn(), identify: jest.fn() } },
        SessionAuthGuard,
        OptionalSessionAuthGuard,
        AdminGuard,
      ],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('201 and calls setCookie', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'test@example.com', username: 'testuser', password: 'Test1234!' })
        .expect(201);

      expect(mockAuthService.register).toHaveBeenCalled();
      expect(mockAuthService.setCookie).toHaveBeenCalled();
    });

    it('400 for invalid body', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'bad-email', username: 'x', password: 'weak' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('200 and calls setCookie', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ emailOrUsername: 'test@example.com', password: 'Test1234!' })
        .expect(200);

      expect(mockAuthService.login).toHaveBeenCalled();
      expect(mockAuthService.setCookie).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('200 and clears cookie', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', 'purechess_session=valid-session-token')
        .expect(200);

      expect(mockAuthService.clearCookie).toHaveBeenCalled();
    });
  });

  describe('GET /api/auth/me', () => {
    it('200 with valid session cookie', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', 'purechess_session=valid-session-token')
        .expect(200);
    });

    it('200 with null user when no cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(200);
      expect(res.body).toEqual({ user: null });
    });
  });

  describe('POST /api/auth/password-reset/request', () => {
    it('always returns 200', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/password-reset/request')
        .send({ email: 'anyone@example.com' })
        .expect(200);

      expect(mockAuthService.requestPasswordReset).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/password-reset/confirm', () => {
    it('200 for valid body', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/password-reset/confirm')
        .send({ token: 'sometoken', newPassword: 'NewPass1!' })
        .expect(200);
    });
  });
});

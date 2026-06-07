import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import type { Response } from 'express';
import { TimeControlCategory } from '@prisma/client';
import type { User } from '@prisma/client';
import type { SafeUser } from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthResult {
  user: SafeUser;
  sessionToken: string;
  sessionExpiresAt: Date;
}

const COOKIE_NAME = 'purechess_session';
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const RESERVED_USERNAMES = new Set([
  'admin', 'purechess', 'system', 'root', 'support', 'help',
  'api', 'www', 'mail', 'info', 'moderator', 'mod', 'staff', 'bot', 'null', 'undefined',
]);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService,
  ) {}

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    };
  }

  setCookie(res: Response, token: string, expiresAt: Date): void {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      expires: expiresAt,
    });
  }

  clearCookie(res: Response): void {
    res.clearCookie(COOKIE_NAME);
  }

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string): Promise<AuthResult> {
    const existingByEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingByEmail) throw new ConflictException('Email already registered');

    const existingByUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingByUsername) throw new ConflictException('Username already taken');

    if (RESERVED_USERNAMES.has(dto.username.toLowerCase())) {
      throw new BadRequestException('Username is reserved');
    }

    const passwordHash = await this.passwords.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        ratings: {
          create: Object.values(TimeControlCategory).map((category) => ({ category })),
        },
      },
    });

    const { token, expiresAt } = await this.sessions.createSession(user.id, ipAddress, userAgent);
    return { user: this.toSafeUser(user), sessionToken: token, sessionExpiresAt: expiresAt };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResult> {
    const isEmail = dto.emailOrUsername.includes('@');
    const user = isEmail
      ? await this.prisma.user.findUnique({ where: { email: dto.emailOrUsername } })
      : await this.prisma.user.findUnique({ where: { username: dto.emailOrUsername } });

    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await this.passwords.verifyPassword(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const { token, expiresAt } = await this.sessions.createSession(user.id, ipAddress, userAgent);
    return { user: this.toSafeUser(user), sessionToken: token, sessionExpiresAt: expiresAt };
  }

  async logout(token?: string): Promise<void> {
    if (token) await this.sessions.revokeSession(token);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const appUrl = this.config.get<string>('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000';
    this.logger.log(`[DEV] Password reset link: ${appUrl}/reset-password?token=${rawToken}`);
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    });

    if (!resetToken) throw new UnauthorizedException('Invalid or expired reset token');

    const passwordHash = await this.passwords.hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: now } }),
    ]);
  }

  async handleOAuth(
    provider: 'google' | 'apple',
    providerUserId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    const oauthAccount = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { user: true },
    });

    let user: User;

    if (oauthAccount) {
      user = oauthAccount.user;
    } else {
      const baseUsername = (email.split('@')[0] ?? 'user')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 16) || 'user';

      let username = baseUsername;
      let suffix = 1;
      while (await this.prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}${suffix++}`;
      }

      user = await this.prisma.user.create({
        data: {
          email,
          username,
          ratings: {
            create: Object.values(TimeControlCategory).map((category) => ({ category })),
          },
          oauthAccounts: {
            create: { provider, providerUserId },
          },
        },
      });
    }

    const { token, expiresAt } = await this.sessions.createSession(user.id, ipAddress, userAgent);
    return { user: this.toSafeUser(user), sessionToken: token, sessionExpiresAt: expiresAt };
  }
}

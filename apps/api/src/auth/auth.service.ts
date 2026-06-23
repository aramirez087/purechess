import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import type { Response } from "express";
import { Prisma } from "@prisma/client";
import { TimeControlCategory } from "@prisma/client";
import type { User } from "@prisma/client";
import type { SafeUser } from "@purechess/shared";
import { PrismaService } from "../database/prisma.service";
import { EmailService } from "../email/email.service";
import { PasswordService } from "./password.service";
import { SessionsService } from "./sessions.service";
import { PosthogService } from "../analytics/posthog.service";
import { isReservedUsername } from "./reserved-usernames";
import { pickAvailableUsername } from "./username-utils";
import { appOrigin } from "./oauth-urls";
import { toSafeUser } from "./safe-user";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

export interface AuthResult {
  user: SafeUser;
  sessionToken: string;
  sessionExpiresAt: Date;
}

const COOKIE_NAME = "purechess_session";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService,
    private readonly posthog: PosthogService,
    private readonly email: EmailService,
  ) {}

  setCookie(res: Response, token: string, expiresAt: Date): void {
    const isProduction = this.config.get<string>("NODE_ENV") === "production";
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      expires: expiresAt,
    });
  }

  clearCookie(res: Response): void {
    const isProduction = this.config.get<string>("NODE_ENV") === "production";
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });
  }

  oauthProviders(): { google: boolean; apple: boolean } {
    return {
      google: Boolean(this.config.get<string>("OAUTH_GOOGLE_CLIENT_ID")),
      apple: Boolean(this.config.get<string>("OAUTH_APPLE_TEAM_ID")),
    };
  }

  async register(
    dto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingByEmail)
      throw new ConflictException("Email already registered");

    const existingByUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingByUsername)
      throw new ConflictException("Username already taken");

    if (isReservedUsername(dto.username)) {
      throw new BadRequestException("Username is reserved");
    }

    const passwordHash = await this.passwords.hashPassword(dto.password);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
          lastLoginAt: new Date(),
          ratings: {
            create: Object.values(TimeControlCategory).map((category) => ({
              category,
            })),
          },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException("Email or username already taken");
      }
      throw err;
    }

    await this.sendVerificationEmail(user);

    const { token, expiresAt } = await this.sessions.createSession(
      user.id,
      ipAddress,
      userAgent,
    );

    this.posthog.identify(user.id, {
      username: user.username,
      $set_once: { first_seen_at: user.createdAt.toISOString() },
    });
    this.posthog.captureEvent(user.id, "user_registered", {
      registration_method: "email",
    });

    return {
      user: toSafeUser(user),
      sessionToken: token,
      sessionExpiresAt: expiresAt,
    };
  }

  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    const isEmail = dto.emailOrUsername.includes("@");
    const user = isEmail
      ? await this.prisma.user.findUnique({
          where: { email: dto.emailOrUsername },
        })
      : await this.prisma.user.findUnique({
          where: { username: dto.emailOrUsername },
        });

    if (!user || !user.passwordHash)
      throw new UnauthorizedException("Invalid credentials");

    const valid = await this.passwords.verifyPassword(
      dto.password,
      user.passwordHash,
    );
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { token, expiresAt } = await this.sessions.createSession(
      user.id,
      ipAddress,
      userAgent,
    );

    this.posthog.identify(user.id, { username: user.username });
    this.posthog.captureEvent(user.id, "user_logged_in", {
      login_method: "email",
    });

    return {
      user: toSafeUser(updated),
      sessionToken: token,
      sessionExpiresAt: expiresAt,
    };
  }

  async logout(token?: string): Promise<void> {
    if (token) await this.sessions.revokeSession(token);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    this.posthog.captureEvent(user.id, "password_reset_requested");

    const resetUrl = `${appOrigin(this.config)}/reset-password?token=${rawToken}`;

    try {
      await this.email.send({
        to: user.email,
        subject: "Reset your PureChess password",
        text: `Reset your password: ${resetUrl}\n\nThis link expires in one hour. If you did not request this, you can ignore this email.`,
        html: `<p>Reset your PureChess password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in one hour. If you did not request this, you can ignore this email.</p>`,
      });
    } catch (err) {
      this.logger.error({ err, userId: user.id }, "Password reset email failed");
      this.logger.log(`[fallback] Password reset link: ${resetUrl}`);
    }
  }

  async confirmPasswordReset(
    token: string,
    newPassword: string,
  ): Promise<void> {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date();

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    });

    if (!resetToken)
      throw new UnauthorizedException("Invalid or expired reset token");

    const passwordHash = await this.passwords.hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, lastLoginAt: now },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: now },
      }),
      this.prisma.session.deleteMany({ where: { userId: resetToken.userId } }),
    ]);

    this.posthog.captureEvent(resetToken.userId, "password_reset_completed");
  }

  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.emailVerifiedAt) return;
    await this.sendVerificationEmail(user);
  }

  async confirmEmailVerification(token: string): Promise<void> {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date();

    const verifyToken = await this.prisma.emailVerificationToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    });

    if (!verifyToken)
      throw new UnauthorizedException("Invalid or expired verification token");

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verifyToken.userId },
        data: { emailVerifiedAt: now },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: verifyToken.id },
        data: { usedAt: now },
      }),
    ]);

    this.posthog.captureEvent(verifyToken.userId, "email_verified");
  }

  async handleOAuth(
    provider: "google" | "apple",
    providerUserId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException("OAuth provider did not return an email");
    }

    const oauthAccount = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { user: true },
    });

    let user: User;
    const now = new Date();

    if (oauthAccount) {
      user = await this.prisma.user.update({
        where: { id: oauthAccount.user.id },
        data: {
          lastLoginAt: now,
          ...(oauthAccount.user.emailVerifiedAt
            ? {}
            : { emailVerifiedAt: now }),
        },
      });
    } else {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingByEmail) {
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            lastLoginAt: now,
            ...(existingByEmail.emailVerifiedAt
              ? {}
              : { emailVerifiedAt: now }),
            oauthAccounts: {
              create: { provider, providerUserId },
            },
          },
        });
      } else {
        const username = await pickAvailableUsername(
          async (candidate) =>
            (await this.prisma.user.findUnique({ where: { username: candidate } })) !=
            null,
          normalizedEmail,
        );

        user = await this.prisma.user.create({
          data: {
            email: normalizedEmail,
            username,
            emailVerifiedAt: now,
            lastLoginAt: now,
            ratings: {
              create: Object.values(TimeControlCategory).map((category) => ({
                category,
              })),
            },
            oauthAccounts: {
              create: { provider, providerUserId },
            },
          },
        });
      }
    }

    const isNewUser = !oauthAccount;
    const { token, expiresAt } = await this.sessions.createSession(
      user.id,
      ipAddress,
      userAgent,
    );

    this.posthog.identify(user.id, { username: user.username });
    this.posthog.captureEvent(user.id, "oauth_authenticated", {
      provider,
      is_new_user: isNewUser,
    });

    return {
      user: toSafeUser(user),
      sessionToken: token,
      sessionExpiresAt: expiresAt,
    };
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    if (user.emailVerifiedAt) return;

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    const verifyUrl = `${appOrigin(this.config)}/verify-email?token=${rawToken}`;

    try {
      await this.email.send({
        to: user.email,
        subject: "Verify your PureChess email",
        text: `Welcome to PureChess. Verify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
        html: `<p>Welcome to PureChess.</p><p><a href="${verifyUrl}">Verify your email</a></p><p>This link expires in 24 hours.</p>`,
      });
    } catch (err) {
      this.logger.error({ err, userId: user.id }, "Verification email failed");
      this.logger.log(`[fallback] Email verification link: ${verifyUrl}`);
    }
  }
}
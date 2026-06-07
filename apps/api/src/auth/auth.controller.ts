import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import type { AuthResponse } from '@purechess/shared';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { OptionalSessionAuthGuard } from './guards/optional-session-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { GoogleOAuthProfile } from './strategies/google-oauth.strategy';
import type { AppleOAuthProfile } from './strategies/apple-oauth.strategy';

type AuthedRequest = Request & { user?: User };

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() dto: RegisterDto, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const result = await this.auth.register(dto, req.ip, req.headers['user-agent']);
    this.auth.setCookie(res, result.sessionToken, result.sessionExpiresAt);
    return { user: result.user, sessionExpiresAt: result.sessionExpiresAt.toISOString() };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const result = await this.auth.login(dto, req.ip, req.headers['user-agent']);
    this.auth.setCookie(res, result.sessionToken, result.sessionExpiresAt);
    return { user: result.user, sessionExpiresAt: result.sessionExpiresAt.toISOString() };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(OptionalSessionAuthGuard)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token = (req.cookies as Record<string, string>)['purechess_session'];
    await this.auth.logout(token);
    this.auth.clearCookie(res);
  }

  @Get('me')
  @UseGuards(OptionalSessionAuthGuard)
  me(@CurrentUser() user: User | undefined): { user: ReturnType<typeof toSafeUser> | null } {
    return { user: user ? toSafeUser(user) : null };
  }

  @Post('password-reset/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 1, ttl: 300000 } })
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto): Promise<void> {
    await this.auth.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  @HttpCode(200)
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto): Promise<void> {
    await this.auth.confirmPasswordReset(dto.token, dto.newPassword);
  }

  @Get('oauth/google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {}

  @Get('oauth/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request & { user: GoogleOAuthProfile },
    @Res() res: Response,
  ): Promise<void> {
    const profile = req.user;
    const result = await this.auth.handleOAuth(
      'google',
      profile.providerUserId,
      profile.email,
      req.ip,
      req.headers['user-agent'],
    );
    this.auth.setCookie(res, result.sessionToken, result.sessionExpiresAt);
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
    res.redirect(appUrl);
  }

  @Get('oauth/apple')
  @UseGuards(AuthGuard('apple'))
  appleAuth(): void {}

  @Get('oauth/apple/callback')
  @UseGuards(AuthGuard('apple'))
  async appleCallback(
    @Req() req: Request & { user: AppleOAuthProfile },
    @Res() res: Response,
  ): Promise<void> {
    const profile = req.user;
    const result = await this.auth.handleOAuth(
      'apple',
      profile.providerUserId,
      profile.email,
      req.ip,
      req.headers['user-agent'],
    );
    this.auth.setCookie(res, result.sessionToken, result.sessionExpiresAt);
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
    res.redirect(appUrl);
  }
}

function toSafeUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
  };
}

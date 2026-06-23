import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EmailModule } from '../email/email.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';
import { GoogleOAuthStrategy } from './strategies/google-oauth.strategy';
import { AppleOAuthStrategy } from './strategies/apple-oauth.strategy';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { OptionalSessionAuthGuard } from './guards/optional-session-auth.guard';
import { EmailVerifiedGuard } from './guards/email-verified.guard';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [PassportModule, EmailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionsService,
    GoogleOAuthStrategy,
    AppleOAuthStrategy,
    SessionAuthGuard,
    OptionalSessionAuthGuard,
    EmailVerifiedGuard,
    AdminGuard,
  ],
  exports: [AuthService, SessionsService, SessionAuthGuard, OptionalSessionAuthGuard, EmailVerifiedGuard, AdminGuard],
})
export class AuthModule {}

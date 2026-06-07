import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';
import { GoogleOAuthStrategy } from './strategies/google-oauth.strategy';
import { AppleOAuthStrategy } from './strategies/apple-oauth.strategy';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { OptionalSessionAuthGuard } from './guards/optional-session-auth.guard';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionsService,
    GoogleOAuthStrategy,
    AppleOAuthStrategy,
    SessionAuthGuard,
    OptionalSessionAuthGuard,
    AdminGuard,
  ],
  exports: [AuthService, SessionsService, SessionAuthGuard, OptionalSessionAuthGuard, AdminGuard],
})
export class AuthModule {}

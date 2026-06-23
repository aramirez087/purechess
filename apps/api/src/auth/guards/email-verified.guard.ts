import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { User } from '@prisma/client';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user?: User }>();
    const user = req.user;
    if (!user) return false;
    if (user.emailVerifiedAt) return true;
    throw new ForbiddenException('Email verification required');
  }
}
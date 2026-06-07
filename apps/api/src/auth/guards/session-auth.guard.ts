import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SessionsService } from '../sessions.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token: string | undefined = (req.cookies as Record<string, string>)['purechess_session'];

    if (!token) throw new UnauthorizedException();

    const result = await this.sessions.lookupSession(token);
    if (!result) throw new UnauthorizedException();

    req.user = result.user;
    return true;
  }
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { SessionsService } from '../sessions.service';

@Injectable()
export class OptionalSessionAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token: string | undefined = (req.cookies as Record<string, string>)['purchess_session'];

    if (token) {
      const result = await this.sessions.lookupSession(token);
      if (result) req.user = result.user;
    }

    return true;
  }
}

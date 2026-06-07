import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import type { Session, User } from '@prisma/client';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SLIDE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private hmac(token: string): string {
    const secret = this.config.get<string>('SESSION_SECRET')!;
    return createHmac('sha256', secret).update(token).digest('hex');
  }

  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const rawBytes = randomBytes(32);
    const token = rawBytes.toString('base64url');
    const id = this.hmac(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.session.create({
      data: { id, userId, ipAddress, userAgent, expiresAt },
    });

    return { token, expiresAt };
  }

  async lookupSession(token: string): Promise<{ session: Session; user: User } | null> {
    const id = this.hmac(token);
    const now = new Date();

    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!session || session.expiresAt < now) return null;
    if ((session as Session & { user: User }).user.isDisabled) return null;

    if (session.expiresAt.getTime() - now.getTime() < SLIDE_THRESHOLD_MS) {
      const newExpiry = new Date(now.getTime() + SESSION_TTL_MS);
      await this.prisma.session.update({ where: { id }, data: { expiresAt: newExpiry } });
      session.expiresAt = newExpiry;
    }

    return { session, user: (session as Session & { user: User }).user };
  }

  async revokeSession(token: string): Promise<void> {
    const id = this.hmac(token);
    await this.prisma.session.deleteMany({ where: { id } });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}

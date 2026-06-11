import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { randomBytes, createHmac } from 'crypto';

@Injectable()
export class TestingService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(opts: {
    username: string;
    email: string;
    isAdmin?: boolean;
  }): Promise<{ id: string; username: string; email: string; sessionToken: string }> {
    const user = await this.prisma.user.create({
      data: {
        username: opts.username,
        email: opts.email,
        passwordHash: null,
        isAdmin: opts.isAdmin ?? false,
      },
    });

    const sessionToken = randomBytes(32).toString('base64url');
    const sessionId = createHmac('sha256', 'test-secret').update(sessionToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: { id: sessionId, userId: user.id, expiresAt },
    });

    return { id: user.id, username: user.username, email: user.email, sessionToken };
  }

  async createSession(userId: string): Promise<{ sessionToken: string }> {
    const sessionToken = randomBytes(32).toString('base64url');
    const sessionId = createHmac('sha256', 'test-secret').update(sessionToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: { id: sessionId, userId, expiresAt },
    });

    return { sessionToken };
  }

  async createGame(opts: {
    whiteUserId?: string;
    blackUserId?: string;
    status?: string;
    timeControlSeconds?: number;
    incrementSeconds?: number;
    category?: string;
    isRated?: boolean;
  }): Promise<{ id: string }> {
    const game = await this.prisma.game.create({
      data: {
        whiteUserId: opts.whiteUserId ?? null,
        blackUserId: opts.blackUserId ?? null,
        status: (opts.status ?? 'active') as never,
        timeControlSeconds: opts.timeControlSeconds ?? 180,
        incrementSeconds: opts.incrementSeconds ?? 0,
        category: (opts.category ?? 'blitz') as never,
        isRated: opts.isRated ?? true,
        pgn: '',
        startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      },
    });

    return { id: game.id };
  }

  async reset(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.move.deleteMany(),
      this.prisma.adminAuditLog.deleteMany(),
      this.prisma.fairPlaySignal.deleteMany(),
      this.prisma.report.deleteMany(),
      this.prisma.ratingHistory.deleteMany(),
      this.prisma.rating.deleteMany(),
      this.prisma.game.deleteMany(),
      this.prisma.session.deleteMany(),
      this.prisma.passwordResetToken.deleteMany(),
      this.prisma.oAuthAccount.deleteMany(),
      this.prisma.user.deleteMany(),
    ]);
  }
}

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from './audit.service';
import { ListUsersDto } from './dto/list-users.dto';
import { ListGamesDto } from './dto/list-games.dto';
import { ListAuditDto } from './dto/list-audit.dto';
import type Redis from 'ioredis';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async listUsers(dto: ListUsersDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {};
    if (dto.q) {
      where.OR = [
        { username: { contains: dto.q, mode: 'insensitive' } },
        { email: { contains: dto.q, mode: 'insensitive' } },
      ];
    }
    if (dto.disabled !== undefined) {
      where.isDisabled = dto.disabled;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
          lastLoginAt: true,
          isDisabled: true,
          isAdmin: true,
          ratings: { select: { category: true, rating: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, page, pageSize, total };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        ratings: true,
        oauthAccounts: { select: { provider: true, createdAt: true } },
        fairPlaySignals: { orderBy: { createdAt: 'desc' } },
        _count: { select: { gamesAsWhite: true, gamesAsBlack: true, reportsReceived: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async disableUser(adminId: string, targetId: string, reason: string) {
    if (adminId === targetId) throw new BadRequestException('Cannot disable your own account');

    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({ where: { id: targetId }, data: { isDisabled: true } });
    await this.prisma.session.deleteMany({ where: { userId: targetId } });
    await this.redis.publish('user-disabled', targetId);

    await this.audit.log(adminId, 'disable_user', 'User', targetId, { reason });
    return { ok: true };
  }

  async enableUser(adminId: string, targetId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({ where: { id: targetId }, data: { isDisabled: false } });
    await this.audit.log(adminId, 'enable_user', 'User', targetId, {});
    return { ok: true };
  }

  async listGames(dto: ListGamesDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.GameWhereInput = {};
    if (dto.userId) {
      where.OR = [{ whiteUserId: dto.userId }, { blackUserId: dto.userId }];
    }
    if (dto.status) where.status = dto.status;
    if (dto.category) where.category = dto.category;
    if (dto.isRated !== undefined) where.isRated = dto.isRated;
    if (dto.from || dto.to) {
      where.createdAt = {};
      if (dto.from) where.createdAt.gte = new Date(dto.from);
      if (dto.to) where.createdAt.lte = new Date(dto.to);
    }

    const [games, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          category: true,
          timeControlSeconds: true,
          incrementSeconds: true,
          isRated: true,
          status: true,
          result: true,
          resultReason: true,
          endedAt: true,
          createdAt: true,
          whitePlayer: { select: { id: true, username: true } },
          blackPlayer: { select: { id: true, username: true } },
        },
      }),
      this.prisma.game.count({ where }),
    ]);

    return { games, page, pageSize, total };
  }

  async getGame(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: {
        moves: { orderBy: { ply: 'asc' } },
        whitePlayer: { include: { ratings: true } },
        blackPlayer: { include: { ratings: true } },
        fairPlaySignals: true,
      },
    });
    if (!game) throw new NotFoundException('Game not found');
    return game;
  }

  async getQueues() {
    const keys = await this.redis.keys('matchmaking:queue:*');
    const buckets: Record<string, { count: number; oldestWaitMs: number }> = {};

    await Promise.all(
      keys.map(async (key) => {
        const bucket = key.replace('matchmaking:queue:', '');
        const members = await this.redis.zrangebyscore(key, '-inf', '+inf', 'WITHSCORES');
        const count = members.length / 2;
        const oldestScore = count > 0 ? Number(members[1]) : 0;
        const oldestWaitMs = oldestScore > 0 ? Date.now() - oldestScore : 0;
        buckets[bucket] = { count, oldestWaitMs };
      }),
    );

    return { buckets };
  }

  async getActiveGames() {
    const [count, sample] = await Promise.all([
      this.prisma.game.count({ where: { status: 'active' } }),
      this.prisma.game.findMany({
        where: { status: 'active' },
        take: 10,
        orderBy: { startedAt: 'asc' },
        select: {
          id: true,
          category: true,
          startedAt: true,
          whitePlayer: { select: { id: true, username: true } },
          blackPlayer: { select: { id: true, username: true } },
          _count: { select: { moves: true } },
        },
      }),
    ]);

    return { count, sample };
  }

  async listAudit(dto: ListAuditDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AdminAuditLogWhereInput = {};
    if (dto.adminUserId) where.adminUserId = dto.adminUserId;
    if (dto.action) where.action = dto.action;

    const [logs, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { id: true, username: true } } },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return { logs, page, pageSize, total };
  }
}

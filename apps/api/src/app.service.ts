import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import Redis from 'ioredis';

export interface HealthStatus {
  status: 'ok' | 'error';
  db: 'ok' | 'error';
  redis: 'ok' | 'error';
  uptime: number;
}

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async getHealth(): Promise<HealthStatus> {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
    ]);

    const status = dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'error';

    return {
      status,
      db: dbStatus,
      redis: redisStatus,
      uptime: Math.floor(process.uptime()),
    };
  }

  private async checkDb(): Promise<'ok' | 'error'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<'ok' | 'error'> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}

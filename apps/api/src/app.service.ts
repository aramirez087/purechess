import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import Redis from 'ioredis';

export interface HealthStatus {
  status: 'ok' | 'error';
  db: 'ok' | 'error';
  redis: 'ok' | 'error';
  uptime: number;
}

const HEALTH_CHECK_TIMEOUT_MS = 1500;

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

    const status: HealthStatus['status'] =
      dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'error';

    return {
      status,
      db: dbStatus,
      redis: redisStatus,
      uptime: Math.floor(process.uptime()),
    };
  }

  private async checkDb(): Promise<'ok' | 'error'> {
    return this.withTimeout(this.prisma.$queryRaw`SELECT 1`.then(() => 'ok' as const));
  }

  private async checkRedis(): Promise<'ok' | 'error'> {
    return this.withTimeout(
      this.redis
        .ping()
        .then((pong) => (pong === 'PONG' ? ('ok' as const) : ('error' as const))),
    );
  }

  private async withTimeout(
    check: Promise<'ok' | 'error'>,
  ): Promise<'ok' | 'error'> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        check,
        new Promise<'error'>((resolve) => {
          timer = setTimeout(() => {
            resolve('error');
          }, HEALTH_CHECK_TIMEOUT_MS);
        }),
      ]);
    } catch {
      return 'error';
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

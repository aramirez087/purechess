import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Stay under Neon's default 5-min autosuspend window so the compute never sleeps. */
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private keepalive?: ReturnType<typeof setInterval>;

  async onModuleInit() {
    await this.$connect();
    // Neon autosuspends an idle compute (0.5–2s cold wake), which would blow
    // the live-game resync budget on the first move after a quiet spell. A
    // cheap `SELECT 1` every ~4 min keeps the compute warm so no real request
    // ever eats the wake. Disabled under test so it never leaks an open handle
    // into Jest or fires against a mocked client.
    if (process.env['NODE_ENV'] !== 'test') {
      this.keepalive = setInterval(() => {
        // Transient failures are fine — the next tick retries, and real
        // traffic surfaces a hard outage anyway.
        void this.$queryRaw`SELECT 1`.catch(() => undefined);
      }, KEEPALIVE_INTERVAL_MS);
      // Never hold the event loop (or a test runner) open on this timer alone.
      this.keepalive.unref?.();
    }
  }

  async onModuleDestroy() {
    if (this.keepalive) {
      clearInterval(this.keepalive);
      this.keepalive = undefined;
    }
    await this.$disconnect();
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { INVITE_TTL_MS } from '../invites/invites.service';

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
/** First sweep shortly after boot so restarts clean up promptly. */
const FIRST_SWEEP_DELAY_MS = 30 * 1000;
/** An unanswered rematch offer is dead after an hour. */
const REMATCH_OFFER_TTL_MS = 60 * 60 * 1000;
/** Matched/accepted games nobody ever fetched (no engine state) are dead after 10 min. */
const NEVER_FETCHED_TTL_MS = 10 * 60 * 1000;

/**
 * Periodic cleanup for game rows that no request path will ever revisit:
 *
 *  1. Ignored rematch offers — `invite_pending` games with NO inviteToken
 *     (rematch-created). Aborting one also clears the old game's rematch
 *     link, mirroring declineRematch, so a re-offer stays possible.
 *  2. Expired friend invites — `invite_pending` WITH an inviteToken past
 *     INVITE_TTL_MS. Preview/accept already expire these lazily; the sweep
 *     catches invites nobody ever revisits.
 *  3. Never-fetched active games — matched/accepted rows whose engine state
 *     was never initialized (no state fetch by either player). Aborted with
 *     no result and no rating change, like a ply<2 abort.
 *
 * Every write is status-guarded (updateMany + count check) so the sweep can
 * never race an accept/fetch into a bad state — the loser simply no-ops.
 * Same lifecycle pattern as the PrismaService Neon keepalive: unref'd
 * timers, disabled under test.
 */
@Injectable()
export class GamesJanitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GamesJanitorService.name);
  private interval?: ReturnType<typeof setInterval>;
  private firstSweep?: ReturnType<typeof setTimeout>;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env['NODE_ENV'] === 'test') return;
    this.firstSweep = setTimeout(() => void this.sweep(), FIRST_SWEEP_DELAY_MS);
    this.firstSweep.unref?.();
    this.interval = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.interval.unref?.();
  }

  onModuleDestroy() {
    if (this.firstSweep) clearTimeout(this.firstSweep);
    if (this.interval) clearInterval(this.interval);
    this.firstSweep = undefined;
    this.interval = undefined;
  }

  /** One full pass. Public so tests can drive it directly. */
  async sweep(): Promise<void> {
    try {
      const rematches = await this.sweepStaleRematchOffers();
      const invites = await this.sweepExpiredInvites();
      const unfetched = await this.sweepNeverFetchedGames();
      if (rematches + invites + unfetched > 0) {
        this.logger.log(
          `swept ${rematches} stale rematch offer(s), ${invites} expired invite(s), ${unfetched} never-fetched game(s)`,
        );
      }
    } catch (err) {
      // Transient DB failure — the next tick retries.
      this.logger.warn(`sweep failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async sweepStaleRematchOffers(): Promise<number> {
    const cutoff = new Date(Date.now() - REMATCH_OFFER_TTL_MS);
    const stale = await this.prisma.game.findMany({
      where: { status: 'invite_pending', inviteToken: null, createdAt: { lt: cutoff } },
      select: { id: true },
    });

    let swept = 0;
    for (const { id } of stale) {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const aborted = await tx.game.updateMany({
          where: { id, status: 'invite_pending' },
          data: { status: 'aborted', endedAt: new Date() },
        });
        // Accepted between scan and abort — the game is live, leave the link.
        if (aborted.count === 0) return;
        await tx.game.updateMany({
          where: { rematchGameId: id },
          data: { rematchGameId: null, rematchOfferedBy: null },
        });
        swept++;
      });
    }
    return swept;
  }

  private async sweepExpiredInvites(): Promise<number> {
    const cutoff = new Date(Date.now() - INVITE_TTL_MS);
    const res = await this.prisma.game.updateMany({
      where: { status: 'invite_pending', inviteToken: { not: null }, createdAt: { lt: cutoff } },
      data: { status: 'aborted', endedAt: new Date() },
    });
    return res.count;
  }

  private async sweepNeverFetchedGames(): Promise<number> {
    const cutoff = new Date(Date.now() - NEVER_FETCHED_TTL_MS);
    const res = await this.prisma.game.updateMany({
      where: {
        status: 'active',
        isVsComputer: false,
        // Engine state initializes on the first GET /state — null means no
        // player ever looked at the game. The guard also closes the race
        // with ensureEngineState: once it writes, this matches nothing.
        engineState: { equals: Prisma.AnyNull },
        startedAt: { lt: cutoff },
      },
      data: { status: 'aborted', endedAt: new Date() },
    });
    return res.count;
  }
}

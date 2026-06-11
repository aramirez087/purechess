import { Prisma } from '@prisma/client';
import { GamesJanitorService } from '../../src/games/games-janitor.service';
import { PrismaService } from '../../src/database/prisma.service';

type Fn = jest.Mock;

function buildPrismaMock() {
  const tx = { game: { updateMany: jest.fn() } };
  const prisma = {
    game: { findMany: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma, tx };
}

function build() {
  const { prisma, tx } = buildPrismaMock();
  const service = new GamesJanitorService(prisma as unknown as PrismaService);
  return { service, prisma, tx };
}

describe('GamesJanitorService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does not start timers under NODE_ENV=test', () => {
    const { service } = build();
    service.onModuleInit();
    // Private fields — reach in to assert nothing was armed.
    expect((service as unknown as { interval?: unknown }).interval).toBeUndefined();
    expect((service as unknown as { firstSweep?: unknown }).firstSweep).toBeUndefined();
  });

  describe('stale rematch offers', () => {
    it('aborts the pending game and clears the old game link in one tx', async () => {
      const { service, prisma, tx } = build();
      prisma.game.findMany.mockResolvedValue([{ id: 'rematch-1' }]);
      prisma.game.updateMany.mockResolvedValue({ count: 0 });
      tx.game.updateMany
        .mockResolvedValueOnce({ count: 1 }) // guarded abort
        .mockResolvedValueOnce({ count: 1 }); // link clear

      await service.sweep();

      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'invite_pending', inviteToken: null }),
        }),
      );
      expect(tx.game.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: 'rematch-1', status: 'invite_pending' },
        data: expect.objectContaining({ status: 'aborted' }),
      });
      expect(tx.game.updateMany).toHaveBeenNthCalledWith(2, {
        where: { rematchGameId: 'rematch-1' },
        data: { rematchGameId: null, rematchOfferedBy: null },
      });
    });

    it('leaves the link intact when the offer was accepted between scan and abort', async () => {
      const { service, prisma, tx } = build();
      prisma.game.findMany.mockResolvedValue([{ id: 'rematch-1' }]);
      prisma.game.updateMany.mockResolvedValue({ count: 0 });
      tx.game.updateMany.mockResolvedValueOnce({ count: 0 }); // lost the guard

      await service.sweep();

      expect(tx.game.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  it('sweeps expired friend invites with the token + TTL filter', async () => {
    const { service, prisma } = build();
    prisma.game.findMany.mockResolvedValue([]);
    prisma.game.updateMany.mockResolvedValue({ count: 2 });

    await service.sweep();

    const inviteCall = (prisma.game.updateMany as Fn).mock.calls.find(
      ([arg]) => arg.where.inviteToken && arg.where.inviteToken.not === null,
    );
    expect(inviteCall).toBeDefined();
    expect(inviteCall![0].where.status).toBe('invite_pending');
    expect(inviteCall![0].where.createdAt.lt).toBeInstanceOf(Date);
    expect(inviteCall![0].data.status).toBe('aborted');
  });

  it('sweeps never-fetched active games guarded on null engine state', async () => {
    const { service, prisma } = build();
    prisma.game.findMany.mockResolvedValue([]);
    prisma.game.updateMany.mockResolvedValue({ count: 1 });

    await service.sweep();

    const deadCall = (prisma.game.updateMany as Fn).mock.calls.find(
      ([arg]) => arg.where.status === 'active',
    );
    expect(deadCall).toBeDefined();
    expect(deadCall![0].where).toMatchObject({
      status: 'active',
      isVsComputer: false,
      engineState: { equals: Prisma.AnyNull },
    });
    expect(deadCall![0].where.startedAt.lt).toBeInstanceOf(Date);
    expect(deadCall![0].data.status).toBe('aborted');
  });

  it('swallows transient DB failures (next tick retries)', async () => {
    const { service, prisma } = build();
    prisma.game.findMany.mockRejectedValue(new Error('db down'));

    await expect(service.sweep()).resolves.toBeUndefined();
  });
});

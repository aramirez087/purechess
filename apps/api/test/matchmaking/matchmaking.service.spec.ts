import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { MatchmakingService } from '../../src/matchmaking/matchmaking.service';
import { PrismaService } from '../../src/database/prisma.service';
import { RealtimeService } from '../../src/realtime/realtime.service';
import { PosthogService } from '../../src/analytics/posthog.service';

const USER_ID = 'user-a';
const OPP_ID = 'user-b';
const POOL = 'mm:q:rated:180+0';

const mockRedis = {
  defineCommand: jest.fn(),
  mmJoin: jest.fn(),
  hget: jest.fn(),
  hgetall: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  zrem: jest.fn(),
  expire: jest.fn(),
};

const mockPrisma = {
  game: { findFirst: jest.fn(), create: jest.fn() },
  rating: { findUnique: jest.fn() },
};

const mockRealtime = {
  emitMatchFound: jest.fn(),
};

const mockPosthog = {
  captureEvent: jest.fn(),
  captureException: jest.fn(),
  identify: jest.fn(),
};

const JOIN_DTO = {
  timeControlSeconds: 180,
  incrementSeconds: 0,
  category: 'blitz' as const,
  rated: true,
};

describe('MatchmakingService', () => {
  let service: MatchmakingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.hget.mockResolvedValue(null);
    mockRedis.hgetall.mockResolvedValue({});
    mockRedis.get.mockResolvedValue(null);
    mockRedis.mmJoin.mockResolvedValue(null);
    mockPrisma.game.findFirst.mockResolvedValue(null);
    mockPrisma.rating.findUnique.mockResolvedValue(null);
    mockPrisma.game.create.mockResolvedValue({ id: 'game-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingService,
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RealtimeService, useValue: mockRealtime },
        { provide: PosthogService, useValue: mockPosthog },
      ],
    }).compile();
    service = module.get(MatchmakingService);
  });

  it('registers the claim-or-enqueue script once', () => {
    expect(mockRedis.defineCommand).toHaveBeenCalledWith(
      'mmJoin',
      expect.objectContaining({ numberOfKeys: 1 }),
    );
  });

  describe('join', () => {
    it('queues into the exact preset pool with the default 1500 rating', async () => {
      const res = await service.join(USER_ID, JOIN_DTO);

      expect(res).toEqual({ status: 'queued' });
      expect(mockRedis.mmJoin).toHaveBeenCalledWith(
        POOL,
        USER_ID,
        1500,
        200,
        expect.any(Number),
        30,
        180,
        0,
        'blitz',
        '1',
        '0',
      );
      expect(mockPosthog.captureEvent).toHaveBeenCalledWith(
        USER_ID,
        'matchmaking_joined',
        expect.objectContaining({ category: 'blitz', rated: true }),
      );
    });

    it('uses the seeded rating for the chosen category', async () => {
      mockPrisma.rating.findUnique.mockResolvedValue({ rating: 1873 });

      await service.join(USER_ID, JOIN_DTO);

      expect(mockPrisma.rating.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_category: { userId: USER_ID, category: 'blitz' } },
        }),
      );
      expect(mockRedis.mmJoin.mock.calls[0][2]).toBe(1873);
    });

    it('creates an active game for both players when a candidate is claimed', async () => {
      mockRedis.mmJoin.mockResolvedValue(OPP_ID);
      const rand = jest.spyOn(Math, 'random').mockReturnValue(0.25); // caller white

      const res = await service.join(USER_ID, JOIN_DTO);

      expect(res).toEqual({ status: 'matched', gameId: 'game-1' });
      expect(mockPrisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            whiteUserId: USER_ID,
            blackUserId: OPP_ID,
            timeControlSeconds: 180,
            incrementSeconds: 0,
            category: 'blitz',
            isRated: true,
            status: 'active',
            startedAt: expect.any(Date),
          }),
        }),
      );
      // Mailboxes cover a missed push for either side.
      expect(mockRedis.set).toHaveBeenCalledWith(`mm:match:${USER_ID}`, 'game-1', 'EX', 60);
      expect(mockRedis.set).toHaveBeenCalledWith(`mm:match:${OPP_ID}`, 'game-1', 'EX', 60);
      // Mirrored colors and opponent ids.
      expect(mockRealtime.emitMatchFound).toHaveBeenCalledWith(USER_ID, {
        gameId: 'game-1',
        color: 'w',
        opponentId: OPP_ID,
      });
      expect(mockRealtime.emitMatchFound).toHaveBeenCalledWith(OPP_ID, {
        gameId: 'game-1',
        color: 'b',
        opponentId: USER_ID,
      });
      rand.mockRestore();
    });

    it('rejects when already in an active PvP game', async () => {
      mockPrisma.game.findFirst.mockResolvedValue({ id: 'live-game' });

      await expect(service.join(USER_ID, JOIN_DTO)).rejects.toThrow(ConflictException);
      expect(mockRedis.mmJoin).not.toHaveBeenCalled();
    });

    it('rejects a non-preset time control', async () => {
      await expect(service.join(USER_ID, { ...JOIN_DTO, timeControlSeconds: 999 })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRedis.mmJoin).not.toHaveBeenCalled();
    });

    it('switching pools leaves the old queue first', async () => {
      mockRedis.hget.mockResolvedValue('mm:q:rated:60+0');

      await service.join(USER_ID, JOIN_DTO);

      expect(mockRedis.zrem).toHaveBeenCalledWith('mm:q:rated:60+0', USER_ID);
      expect(mockRedis.del).toHaveBeenCalledWith(`mm:u:${USER_ID}`);
      expect(mockRedis.mmJoin).toHaveBeenCalledWith(
        POOL,
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('leave', () => {
    it('removes the queue entry and is idempotent', async () => {
      mockRedis.hget.mockResolvedValueOnce(POOL);
      await expect(service.leave(USER_ID)).resolves.toEqual({ ok: true });
      expect(mockRedis.zrem).toHaveBeenCalledWith(POOL, USER_ID);
      expect(mockRedis.del).toHaveBeenCalledWith(`mm:u:${USER_ID}`);

      mockRedis.hget.mockResolvedValueOnce(null);
      await expect(service.leave(USER_ID)).resolves.toEqual({ ok: true });
    });
  });

  describe('status', () => {
    it('returns idle when not queued', async () => {
      await expect(service.status(USER_ID)).resolves.toEqual({ status: 'idle' });
    });

    it('drains the match mailbox (missed-push recovery)', async () => {
      mockRedis.get.mockResolvedValue('game-9');

      const res = await service.status(USER_ID);

      expect(res).toEqual({ status: 'matched', gameId: 'game-9' });
      expect(mockRedis.del).toHaveBeenCalledWith(`mm:match:${USER_ID}`);
    });

    it('refreshes the TTL and widens the window with wait time', async () => {
      const joinedAt = Date.now() - 25_000; // 25s waiting → window 200 + 100*2
      mockRedis.hgetall.mockResolvedValue({
        pool: POOL,
        rating: '1500',
        joinedAt: String(joinedAt),
        timeControlSeconds: '180',
        incrementSeconds: '0',
        category: 'blitz',
        rated: '1',
      });

      const res = await service.status(USER_ID);

      expect(mockRedis.expire).toHaveBeenCalledWith(`mm:u:${USER_ID}`, 30);
      expect(mockRedis.mmJoin.mock.calls[0][3]).toBe(400);
      expect(res).toEqual({ status: 'queued', waitSeconds: 25 });
    });

    it('caps the widened window at 800', async () => {
      mockRedis.hgetall.mockResolvedValue({
        pool: POOL,
        rating: '1500',
        joinedAt: String(Date.now() - 600_000),
        timeControlSeconds: '180',
        incrementSeconds: '0',
        category: 'blitz',
        rated: '1',
      });

      await service.status(USER_ID);

      expect(mockRedis.mmJoin.mock.calls[0][3]).toBe(800);
    });

    it('re-scans demand the own entry still exist (no ghost re-enqueue)', async () => {
      // The status poll read its entry just before an opponent's claim
      // deleted it — the script must NOT re-enqueue the already-matched
      // player; the pairing arrives via the mailbox on the next poll.
      mockRedis.hgetall.mockResolvedValue({
        pool: POOL,
        rating: '1500',
        joinedAt: String(Date.now() - 4_000),
        timeControlSeconds: '180',
        incrementSeconds: '0',
        category: 'blitz',
        rated: '1',
      });
      mockRedis.mmJoin.mockResolvedValue('__claimed__');

      const res = await service.status(USER_ID);

      expect(mockRedis.mmJoin.mock.calls[0][10]).toBe('1');
      expect(res).toEqual({ status: 'queued', waitSeconds: 4 });
      expect(mockPrisma.game.create).not.toHaveBeenCalled();
    });

    it('creates the game when the widened scan claims an opponent', async () => {
      mockRedis.hgetall.mockResolvedValue({
        pool: POOL,
        rating: '1500',
        joinedAt: String(Date.now() - 12_000),
        timeControlSeconds: '180',
        incrementSeconds: '0',
        category: 'blitz',
        rated: '1',
      });
      mockRedis.mmJoin.mockResolvedValue(OPP_ID);

      const res = await service.status(USER_ID);

      expect(res).toMatchObject({ status: 'matched', gameId: 'game-1' });
      expect(mockPrisma.game.create).toHaveBeenCalled();
      expect(mockRealtime.emitMatchFound).toHaveBeenCalledTimes(2);
    });
  });
});

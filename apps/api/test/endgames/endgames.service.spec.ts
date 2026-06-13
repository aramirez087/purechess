import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EndgamesService } from '../../src/endgames/endgames.service';
import { TablebaseService } from '../../src/endgames/tablebase.service';
import { PrismaService } from '../../src/database/prisma.service';

const DRILL_A = {
  id: 'd-kq',
  slug: 'kq-vs-k-center',
  name: 'Queen mate',
  category: 'basic_mate',
  fen: '8/8/8/4k3/8/8/3QK3/8 w - - 0 1',
  objective: 'win',
  targetDtm: 20,
  difficulty: 0,
};
const DRILL_B = {
  id: 'd-phil',
  slug: 'philidor',
  name: 'Philidor',
  category: 'rook',
  fen: '8/8/4k3/8/4p3/r7/4K3/4R3 w - - 0 1',
  objective: 'draw',
  targetDtm: null,
  difficulty: 2,
};

const mockPrisma = {
  endgameDrill: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  endgameAttempt: {
    groupBy: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
};

const mockTablebase = {
  probe: jest.fn(),
};

describe('EndgamesService', () => {
  let service: EndgamesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EndgamesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TablebaseService, useValue: mockTablebase },
      ],
    }).compile();
    service = module.get<EndgamesService>(EndgamesService);
  });

  describe('list', () => {
    it('returns the bare catalog (no status) for a signed-out caller', async () => {
      mockPrisma.endgameDrill.findMany.mockResolvedValue([DRILL_A, DRILL_B]);

      const result = await service.list(undefined);

      expect(mockPrisma.endgameAttempt.groupBy).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        slug: 'kq-vs-k-center',
        objective: 'win',
        targetDtm: 20,
        difficulty: 0,
      });
      expect(result[0].attempted).toBeUndefined();
      expect(result[0].solved).toBeUndefined();
      // null targetDtm is omitted, not surfaced as null.
      expect(result[1].targetDtm).toBeUndefined();
    });

    it('merges the user pass/fail per drill (solved iff any attempt succeeded)', async () => {
      mockPrisma.endgameDrill.findMany.mockResolvedValue([DRILL_A, DRILL_B]);
      // Two grouped reads: the first counts ALL attempts, the second counts only
      // SUCCEEDED ones (the `where.succeeded === true` branch). Postgres has no
      // max(boolean), so `solved` is derived from a success COUNT, not _max.
      mockPrisma.endgameAttempt.groupBy.mockImplementation(async ({ where }: any) => {
        if (where?.succeeded === true) {
          // d-kq passed at least once; d-phil never passed.
          return [{ drillId: 'd-kq', _count: { _all: 1 } }];
        }
        return [
          { drillId: 'd-kq', _count: { _all: 3 } },
          { drillId: 'd-phil', _count: { _all: 2 } },
        ];
      });

      const result = await service.list('u1');

      // Both groupBys are scoped to the user; the success one filters succeeded.
      expect(mockPrisma.endgameAttempt.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      );
      expect(mockPrisma.endgameAttempt.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1', succeeded: true } }),
      );
      const kq = result.find((d) => d.slug === 'kq-vs-k-center')!;
      const phil = result.find((d) => d.slug === 'philidor')!;
      expect(kq).toMatchObject({ attempted: true, solved: true });
      expect(phil).toMatchObject({ attempted: true, solved: false });
    });

    it('marks a never-attempted drill as not attempted / not solved', async () => {
      mockPrisma.endgameDrill.findMany.mockResolvedValue([DRILL_A]);
      mockPrisma.endgameAttempt.groupBy.mockResolvedValue([]); // no attempts (both reads)

      const [kq] = await service.list('u1');
      expect(kq.attempted).toBe(false);
      expect(kq.solved).toBe(false);
    });
  });

  describe('getBySlug', () => {
    it('404s on an unknown slug', async () => {
      mockPrisma.endgameDrill.findUnique.mockResolvedValue(null);
      await expect(service.getBySlug('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the drill with the user status when authed', async () => {
      mockPrisma.endgameDrill.findUnique.mockResolvedValue(DRILL_A);
      // count() called twice: total attempts, then succeeded attempts.
      mockPrisma.endgameAttempt.count.mockImplementation(async ({ where }: any) =>
        where?.succeeded === true ? 1 : 1,
      );
      const dto = await service.getBySlug('kq-vs-k-center', 'u1');
      expect(dto).toMatchObject({ slug: 'kq-vs-k-center', attempted: true, solved: true });
    });

    it('marks attempted-but-never-solved correctly (no max(boolean))', async () => {
      mockPrisma.endgameDrill.findUnique.mockResolvedValue(DRILL_A);
      mockPrisma.endgameAttempt.count.mockImplementation(async ({ where }: any) =>
        where?.succeeded === true ? 0 : 2,
      );
      const dto = await service.getBySlug('kq-vs-k-center', 'u1');
      expect(dto).toMatchObject({ attempted: true, solved: false });
    });
  });

  describe('probe', () => {
    it('validates the slug then proxies the tablebase result', async () => {
      mockPrisma.endgameDrill.findUnique.mockResolvedValue({ id: 'd-kq' });
      mockTablebase.probe.mockResolvedValue({ category: 'win', bestMove: 'd2d5', dtm: 17 });

      const result = await service.probe('kq-vs-k-center', '8/8/8/4k3/8/8/3QK3/8 w - - 0 1');

      expect(mockPrisma.endgameDrill.findUnique).toHaveBeenCalledWith({
        where: { slug: 'kq-vs-k-center' },
        select: { id: true },
      });
      expect(mockTablebase.probe).toHaveBeenCalledWith('8/8/8/4k3/8/8/3QK3/8 w - - 0 1');
      expect(result).toEqual({ category: 'win', bestMove: 'd2d5', dtm: 17 });
    });

    it('passes through an unknown probe (no bestMove/dtm)', async () => {
      mockPrisma.endgameDrill.findUnique.mockResolvedValue({ id: 'd-kq' });
      mockTablebase.probe.mockResolvedValue({ category: 'unknown' });

      const result = await service.probe('kq-vs-k-center', 'some-fen');
      expect(result).toEqual({ category: 'unknown' });
    });

    it('404s when probing an unknown slug (not an open proxy)', async () => {
      mockPrisma.endgameDrill.findUnique.mockResolvedValue(null);
      await expect(service.probe('nope', 'fen')).rejects.toBeInstanceOf(NotFoundException);
      expect(mockTablebase.probe).not.toHaveBeenCalled();
    });
  });

  describe('recordAttempt', () => {
    it('persists the attempt and returns the recorded row', async () => {
      mockPrisma.endgameDrill.findUnique.mockResolvedValue({ id: 'd-kq' });
      const createdAt = new Date('2026-06-13T12:00:00.000Z');
      mockPrisma.endgameAttempt.create.mockResolvedValue({
        id: 'a1',
        userId: 'u1',
        drillId: 'd-kq',
        succeeded: true,
        movesPlayed: 11,
        createdAt,
      });

      const result = await service.recordAttempt('u1', 'kq-vs-k-center', {
        succeeded: true,
        movesPlayed: 11,
      });

      expect(mockPrisma.endgameAttempt.create).toHaveBeenCalledWith({
        data: { userId: 'u1', drillId: 'd-kq', succeeded: true, movesPlayed: 11 },
      });
      expect(result).toEqual({
        drillId: 'd-kq',
        slug: 'kq-vs-k-center',
        succeeded: true,
        movesPlayed: 11,
        recordedAt: '2026-06-13T12:00:00.000Z',
      });
    });

    it('404s on an unknown slug without writing', async () => {
      mockPrisma.endgameDrill.findUnique.mockResolvedValue(null);
      await expect(
        service.recordAttempt('u1', 'nope', { succeeded: false, movesPlayed: 0 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.endgameAttempt.create).not.toHaveBeenCalled();
    });
  });
});

describe('TablebaseService', () => {
  // A minimal Redis double — get/setex over an in-memory map so we can assert
  // the cache is HIT on a second probe (one upstream fetch, not two).
  function makeRedis() {
    const store = new Map<string, string>();
    return {
      store,
      get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      setex: jest.fn((k: string, _ttl: number, v: string) => {
        store.set(k, v);
        return Promise.resolve('OK');
      }),
    };
  }

  // Build the service with the Redis double via Nest DI (mirrors production).
  async function build(redis: ReturnType<typeof makeRedis>) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TablebaseService,
        { provide: 'REDIS_CLIENT', useValue: redis },
      ],
    }).compile();
    return module.get<TablebaseService>(TablebaseService);
  }

  const KQ_FEN = '8/8/8/4k3/8/8/3QK3/8 w - - 0 1'; // 4 men, in tablebase

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('caches a known probe hard (second call does not re-fetch)', async () => {
    const redis = makeRedis();
    const service = await build(redis);

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        category: 'win',
        dtm: 17,
        moves: [{ uci: 'd2d5', category: 'win', dtm: 17 }],
      }),
    } as unknown as Response);

    const first = await service.probe(KQ_FEN);
    const second = await service.probe(KQ_FEN);

    expect(first).toEqual({ category: 'win', bestMove: 'd2d5', dtm: 17 });
    expect(second).toEqual(first);
    // Cached hard: only ONE upstream fetch, one cache write, second read is a hit.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(redis.setex).toHaveBeenCalledTimes(1);
    expect(redis.setex.mock.calls[0][0]).toBe(`endgame:tb:${KQ_FEN}`);
  });

  it('returns unknown for >7 men WITHOUT calling the tablebase', async () => {
    const redis = makeRedis();
    const service = await build(redis);
    const fetchSpy = jest.spyOn(global, 'fetch');

    // Full opening position: 32 men.
    const result = await service.probe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    expect(result).toEqual({ category: 'unknown' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('degrades to unknown on an upstream error and does NOT cache it', async () => {
    const redis = makeRedis();
    const service = await build(redis);
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('network down'));

    const result = await service.probe(KQ_FEN);
    expect(result).toEqual({ category: 'unknown' });
    // An unknown from a transient failure is NOT pinned (next probe can retry).
    expect(redis.setex).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('maps a loss category and the defender best move', async () => {
    const redis = makeRedis();
    const service = await build(redis);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        category: 'loss',
        dtm: -12,
        moves: [{ uci: 'e5e6', category: 'loss', dtm: -12 }],
      }),
    } as unknown as Response);

    const result = await service.probe('8/8/8/4k3/8/8/4KQ2/8 b - - 0 1');
    expect(result).toEqual({ category: 'loss', bestMove: 'e5e6', dtm: -12 });
  });
});

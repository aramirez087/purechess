import { Test, TestingModule } from '@nestjs/testing';
import { PuzzleRushService } from '../../src/puzzles/puzzle-rush.service';
import { PuzzleRatingService } from '../../src/puzzles/puzzle-rating.service';
import { PrismaService } from '../../src/database/prisma.service';

// A growing bank of synthetic puzzles spanning a wide rating range. buildSet's
// per-rung `pickNear` query returns the nearest UNUSED puzzle to a target; we
// emulate that against this bank so we can assert escalation + no dupes without
// a real Postgres.
function makeBank(count: number, min: number, step: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `pz-${i}`,
    fen: `fen-${i}`,
    moves: [`m${i}`],
    rating: min + i * step,
    ratingDeviation: 80,
    popularity: 90,
    plays: 10,
    themes: ['fork'],
    openingTags: [],
  }));
}

const BANK = makeBank(120, 600, 25); // ratings 600..3575, dense enough for any band

const mockPrisma = {
  // The rush service issues a single raw query per rung. We parse the bound
  // target out of the Prisma.Sql values and return the nearest unused row,
  // honoring the NOT IN exclusion that the service builds from picked ids.
  $queryRaw: jest.fn(),
};

const mockRating = {
  get: jest.fn(),
};

const mockRedis = {
  set: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hgetall: jest.fn(),
};

describe('PuzzleRushService', () => {
  let service: PuzzleRushService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRating.get.mockResolvedValue({ rating: 1500, deviation: 80, volatility: 0.06 });

    // Emulate the nearest-unused-to-target selection against BANK. The service
    // passes a Prisma.Sql; its `.values` carry the bound params. The target is
    // the LAST value (used in ORDER BY abs(rating - target)); the band bounds
    // and any excluded ids are earlier values.
    mockRedis.hgetall.mockResolvedValue({});
    mockPrisma.$queryRaw.mockImplementation((sql: { sql?: string; values?: unknown[] }) => {
      const text = sql.sql ?? '';
      const values = (sql.values ?? []) as unknown[];
      const excluded = new Set(values.filter((v) => typeof v === 'string') as string[]);

      if (text.includes('BETWEEN')) {
        // pickNear binds [low, high, ...excluded, target]; LIMIT 1.
        const low = Number(values[0]);
        const high = Number(values[1]);
        const target = Number(values[values.length - 1]);
        const candidates = BANK.filter(
          (p) => !excluded.has(p.id) && p.rating >= low && p.rating <= high,
        ).sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target));
        return Promise.resolve(candidates.length > 0 ? [candidates[0]] : []);
      }

      // pickFill binds [...excluded, base, limit]; nearest `limit` to base.
      const limit = Number(values[values.length - 1]);
      const base = Number(values[values.length - 2]);
      const candidates = BANK.filter((p) => !excluded.has(p.id))
        .sort((a, b) => Math.abs(a.rating - base) - Math.abs(b.rating - base))
        .slice(0, limit);
      return Promise.resolve(candidates);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PuzzleRushService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PuzzleRatingService, useValue: mockRating },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();
    service = module.get<PuzzleRushService>(PuzzleRushService);
  });

  describe('buildSet', () => {
    it('returns a set of ~40 puzzles with strictly escalating ratings', async () => {
      const { puzzles } = await service.buildSet('u1', '3min');

      // Dense bank → the full set assembles.
      expect(puzzles.length).toBe(40);

      // The ramp climbs: first puzzle below the user's rating, last above it.
      expect(puzzles[0].rating).toBeLessThan(1500);
      expect(puzzles[puzzles.length - 1].rating).toBeGreaterThan(1500);

      // Monotonic non-decreasing across the set (escalating difficulty). With a
      // dense bank each rung lands on a higher-or-equal row than the last.
      for (let i = 1; i < puzzles.length; i++) {
        expect(puzzles[i].rating).toBeGreaterThanOrEqual(puzzles[i - 1].rating);
      }
      // And it genuinely ramps end-to-end, not flat.
      expect(puzzles[puzzles.length - 1].rating).toBeGreaterThan(puzzles[0].rating);
    });

    it('contains no intra-set duplicate puzzles', async () => {
      const { puzzles } = await service.buildSet('u1', '3min');
      const ids = puzzles.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('starts the ramp below and climbs past the user puzzle rating', async () => {
      mockRating.get.mockResolvedValue({ rating: 2000, deviation: 80, volatility: 0.06 });
      const { puzzles } = await service.buildSet('u1', '3min');
      // Early puzzles are gimmes (below the user's rating); the run climbs past
      // it by the end — the ramp tracks the user, not a fixed band.
      expect(puzzles[0].rating).toBeLessThan(2000);
      expect(puzzles[puzzles.length - 1].rating).toBeGreaterThan(2000);
    });

    it('caches the set in Redis under the run id with a TTL', async () => {
      const { runId } = await service.buildSet('u1', '3min');
      expect(typeof runId).toBe('string');
      expect(runId.length).toBeGreaterThan(0);
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      const [key, payload, ex, ttl] = mockRedis.set.mock.calls[0];
      expect(key).toBe(`puzzle:rush:set:${runId}`);
      expect(ex).toBe('EX');
      expect(typeof ttl).toBe('number');
      // The payload round-trips to the cached set scoped to the user + mode.
      const parsed = JSON.parse(payload as string);
      expect(parsed.userId).toBe('u1');
      expect(parsed.mode).toBe('3min');
      expect(parsed.puzzles.length).toBe(40);
    });

    it('defaults the user rating to 1500 when unrated', async () => {
      mockRating.get.mockResolvedValue({ rating: 1500, deviation: 350, volatility: 0.06 });
      const { puzzles } = await service.buildSet('u-new', '3min');
      expect(puzzles[0].rating).toBeLessThan(1500);
      expect(puzzles[puzzles.length - 1].rating).toBeGreaterThan(1500);
    });
  });

  describe('recordRun', () => {
    it('sets a new PB on the first run and flags isPB', async () => {
      mockRedis.hget.mockResolvedValue(null); // no prior PB

      const res = await service.recordRun('u1', { mode: '3min', score: 12, durationMs: 180000 });

      expect(res).toEqual({ best: 12, isPB: true });
      // Persists the PB to the per-user hash under the mode field.
      expect(mockRedis.hset).toHaveBeenCalledWith('puzzle:rush:pb:u1', '3min', '12');
    });

    it('keeps the existing PB and does NOT write when the run is worse', async () => {
      mockRedis.hget.mockResolvedValue('20'); // prior PB of 20

      const res = await service.recordRun('u1', { mode: '3min', score: 8 });

      expect(res).toEqual({ best: 20, isPB: false });
      expect(mockRedis.hset).not.toHaveBeenCalled();
    });

    it('updates the PB when the run beats it', async () => {
      mockRedis.hget.mockResolvedValue('15');

      const res = await service.recordRun('u1', { mode: '5strikes', score: 22 });

      expect(res).toEqual({ best: 22, isPB: true });
      expect(mockRedis.hset).toHaveBeenCalledWith('puzzle:rush:pb:u1', '5strikes', '22');
    });

    it('tracks PBs independently per mode', async () => {
      // hget is queried for the mode being recorded; here 5strikes has no PB.
      mockRedis.hget.mockResolvedValue(null);
      const res = await service.recordRun('u1', { mode: '5strikes', score: 5 });
      expect(res.isPB).toBe(true);
      expect(mockRedis.hget).toHaveBeenCalledWith('puzzle:rush:pb:u1', '5strikes');
      expect(mockRedis.hset).toHaveBeenCalledWith('puzzle:rush:pb:u1', '5strikes', '5');
    });

    it('clamps a negative score to 0 and defaults the mode to 3min', async () => {
      mockRedis.hget.mockResolvedValue(null);
      const res = await service.recordRun('u1', { score: -3 });
      expect(res).toEqual({ best: 0, isPB: false });
      // A score of 0 is not > prior 0, so no PB write.
      expect(mockRedis.hget).toHaveBeenCalledWith('puzzle:rush:pb:u1', '3min');
      expect(mockRedis.hset).not.toHaveBeenCalled();
    });
  });

  describe('getPersonalBests', () => {
    it('returns 0 for unset modes and the stored value otherwise', async () => {
      mockRedis.hgetall.mockResolvedValue({ '3min': '18' });
      const pb = await service.getPersonalBests('u1');
      expect(pb).toEqual({ '3min': 18, '5strikes': 0 });
    });

    it('returns zeros when nothing is stored', async () => {
      mockRedis.hgetall.mockResolvedValue({});
      const pb = await service.getPersonalBests('u-new');
      expect(pb).toEqual({ '3min': 0, '5strikes': 0 });
    });
  });
});

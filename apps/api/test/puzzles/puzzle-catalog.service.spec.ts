import { Test, TestingModule } from '@nestjs/testing';
import { PuzzleCatalogService } from '../../src/puzzles/puzzle-catalog.service';
import { PrismaService } from '../../src/database/prisma.service';

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
};

const mockPrisma = {
  $queryRaw: jest.fn(),
  puzzle: {
    count: jest.fn(),
    aggregate: jest.fn(),
  },
};

describe('PuzzleCatalogService', () => {
  let service: PuzzleCatalogService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PuzzleCatalogService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();
    service = module.get<PuzzleCatalogService>(PuzzleCatalogService);
  });

  describe('listThemes', () => {
    it('aggregates themes via the raw unnest query and shapes the result', async () => {
      mockRedis.get.mockResolvedValue(null);
      // Postgres count(*) comes back as bigint — assert we coerce to number.
      mockPrisma.$queryRaw.mockResolvedValue([
        { theme: 'fork', count: 1200n },
        { theme: 'pin', count: 800n },
      ]);

      const result = await service.listThemes();

      expect(result).toEqual([
        { theme: 'fork', count: 1200 },
        { theme: 'pin', count: 800 },
      ]);
      // Numbers, not bigints.
      expect(typeof result[0].count).toBe('number');
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      // Caches the JSON for 1h.
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'puzzle:catalog:themes',
        60 * 60,
        JSON.stringify(result),
      );
    });

    it('returns the cached value and does NOT hit the DB on a cache hit', async () => {
      const cached = [{ theme: 'mateIn2', count: 42 }];
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.listThemes();

      expect(result).toEqual(cached);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('a second call after a miss is served from cache (DB hit only once)', async () => {
      // First call: miss → DB → write-through. We emulate Redis filling on setex.
      let store: string | null = null;
      mockRedis.get.mockImplementation(() => Promise.resolve(store));
      mockRedis.setex.mockImplementation((_k: string, _ttl: number, v: string) => {
        store = v;
        return Promise.resolve('OK');
      });
      mockPrisma.$queryRaw.mockResolvedValue([{ theme: 'fork', count: 5n }]);

      const first = await service.listThemes();
      const second = await service.listThemes();

      expect(first).toEqual(second);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('count', () => {
    it('delegates to prisma.puzzle.count', async () => {
      mockPrisma.puzzle.count.mockResolvedValue(49_999);
      await expect(service.count()).resolves.toBe(49_999);
      expect(mockPrisma.puzzle.count).toHaveBeenCalledTimes(1);
    });
  });

  describe('ratingRange', () => {
    it('returns the min/max aggregate', async () => {
      mockPrisma.puzzle.aggregate.mockResolvedValue({
        _min: { rating: 545 },
        _max: { rating: 3210 },
      });
      await expect(service.ratingRange()).resolves.toEqual({ min: 545, max: 3210 });
    });

    it('returns {0,0} for an empty bank (null aggregates)', async () => {
      mockPrisma.puzzle.aggregate.mockResolvedValue({
        _min: { rating: null },
        _max: { rating: null },
      });
      await expect(service.ratingRange()).resolves.toEqual({ min: 0, max: 0 });
    });
  });
});

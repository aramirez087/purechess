import { Test, TestingModule } from '@nestjs/testing';
import { PuzzlesService } from '../../src/puzzles/puzzles.service';
import type { LichessPuzzleData } from '../../src/puzzles/puzzles.types';

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
};

const SAMPLE: LichessPuzzleData = {
  game: { id: 'g1', pgn: '1. e4 e5', players: [] },
  puzzle: {
    id: 'P1',
    initialPly: 2,
    solution: ['e2e4'],
    rating: 1500,
    plays: 10,
    themes: ['fork'],
  },
};

describe('PuzzlesService', () => {
  let service: PuzzlesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PuzzlesService, { provide: 'REDIS_CLIENT', useValue: mockRedis }],
    }).compile();
    service = module.get<PuzzlesService>(PuzzlesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the cached puzzle without hitting the network', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify(SAMPLE));
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await service.getDailyPuzzle();

    expect(result).toEqual(SAMPLE);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });

  it('fetches from Lichess and caches on a miss', async () => {
    mockRedis.get.mockResolvedValue(null);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => SAMPLE,
    } as Response);

    const result = await service.getDailyPuzzle();

    expect(result).toEqual(SAMPLE);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://lichess.org/api/puzzle/daily',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    expect(mockRedis.setex).toHaveBeenCalledWith(
      'puzzle:daily',
      60 * 60 * 24,
      JSON.stringify(SAMPLE),
    );
  });

  it('throws when Lichess responds with an error', async () => {
    mockRedis.get.mockResolvedValue(null);
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response);

    await expect(service.getDailyPuzzle()).rejects.toThrow('lichess puzzle API: 503');
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });
});

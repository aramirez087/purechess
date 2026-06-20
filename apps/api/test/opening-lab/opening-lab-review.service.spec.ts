import { BadRequestException } from '@nestjs/common';
import { OpeningLabReviewService } from '../../src/opening-lab/opening-lab-review.service';
import { __resetOpeningLabBookCache } from '../../src/opening-lab/opening-lab-book';

const mockRedis = {
  hgetall: jest.fn().mockResolvedValue({}),
  hget: jest.fn().mockResolvedValue(null),
  hset: jest.fn().mockResolvedValue(1),
};

describe('OpeningLabReviewService', () => {
  const service = new OpeningLabReviewService(mockRedis as never);

  beforeEach(() => {
    jest.clearAllMocks();
    __resetOpeningLabBookCache();
  });

  it('returns drill lines for Italian Game', async () => {
    const result = await service.getDrillLines('user-1', 'Italian Game', 'white');
    expect(result.family).toBe('Italian Game');
    expect(result.color).toBe('white');
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.lines[0].steps.length).toBeGreaterThan(0);
    expect(result.totalLinesInFamily).toBeGreaterThan(100);
  });

  it('rejects unknown families', async () => {
    await expect(service.getDrillLines('user-1', 'Not A Real Opening', 'white')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('grades a line into Redis', async () => {
    const drill = await service.getDrillLines('user-1', 'Italian Game', 'white');
    const line = drill.lines[0];
    const graded = await service.grade(
      'user-1',
      'Italian Game',
      line.nodePath,
      'white',
      true,
    );
    expect(graded.nodePath).toBe(line.nodePath);
    expect(graded.nextDueAt).toBeTruthy();
    expect(mockRedis.hset).toHaveBeenCalled();
  });
});
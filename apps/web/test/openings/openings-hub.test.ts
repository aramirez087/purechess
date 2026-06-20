import { describe, expect, it } from 'vitest';
import type { RepertoireSummaryDto } from '@purechess/shared';
import { pickDrillTarget } from '@/components/openings/openings-hub';

function rep(
  partial: Partial<RepertoireSummaryDto> & Pick<RepertoireSummaryDto, 'id' | 'name'>,
): RepertoireSummaryDto {
  return {
    color: 'white',
    rootFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    lineCount: 3,
    nodeCount: 6,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('pickDrillTarget', () => {
  it('returns null when no repertoires have lines', () => {
    expect(
      pickDrillTarget([
        rep({ id: 'a', name: 'Empty', lineCount: 0, nodeCount: 0 }),
      ]),
    ).toBeNull();
  });

  it('prefers never-trained repertoires over recently trained ones', () => {
    const older = rep({
      id: 'old',
      name: 'Old',
      lastTrainedAt: '2026-01-01T00:00:00.000Z',
    });
    const fresh = rep({
      id: 'new',
      name: 'Fresh',
      lastTrainedAt: '2026-06-19T00:00:00.000Z',
    });
    const never = rep({ id: 'never', name: 'Never' });

    expect(pickDrillTarget([fresh, older, never])?.id).toBe('never');
  });

  it('picks the least recently trained repertoire when all have history', () => {
    const a = rep({
      id: 'a',
      name: 'A',
      lastTrainedAt: '2026-06-10T00:00:00.000Z',
    });
    const b = rep({
      id: 'b',
      name: 'B',
      lastTrainedAt: '2026-06-01T00:00:00.000Z',
    });

    expect(pickDrillTarget([a, b])?.id).toBe('b');
  });
});
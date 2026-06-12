import { describe, it, expect } from 'vitest';
import { pvToSan } from '@/lib/board/pv-to-san';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('pvToSan', () => {
  it('converts a known 4-move sequence from the start position', () => {
    expect(pvToSan(START, ['e2e4', 'e7e5', 'g1f3', 'b8c6'])).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  });

  it('converts a promotion with its piece suffix', () => {
    const fen = '8/4P3/8/8/8/2k5/8/4K3 w - - 0 1';
    expect(pvToSan(fen, ['e7e8q'])).toEqual(['e8=Q']);
  });

  it('stops at the first invalid move without throwing', () => {
    // e2e4 is illegal the second time — conversion stops there.
    expect(pvToSan(START, ['e2e4', 'e2e4', 'g1f3'])).toEqual(['e4']);
  });

  it('stops on a malformed UCI token', () => {
    expect(pvToSan(START, ['e2e4', 'xx', 'g1f3'])).toEqual(['e4']);
  });

  it('trims to maxMoves', () => {
    const pv = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6'];
    expect(pvToSan(START, pv, 3)).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('defaults maxMoves to 6', () => {
    const pv = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6'];
    expect(pvToSan(START, pv)).toHaveLength(6);
  });

  it('returns [] for an unparseable FEN', () => {
    expect(pvToSan('not a fen', ['e2e4'])).toEqual([]);
  });
});

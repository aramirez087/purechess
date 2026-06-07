import { describe, it, expect } from 'vitest';
import { isPremoveLegal, validatePremove } from '@/lib/board/premove';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('isPremoveLegal', () => {
  it('returns true for a legal e2-e4 move', () => {
    expect(isPremoveLegal(START_FEN, { from: 'e2', to: 'e4' })).toBe(true);
  });

  it('returns false for an illegal move (white pawn moving backward)', () => {
    expect(isPremoveLegal(START_FEN, { from: 'e2', to: 'e1' })).toBe(false);
  });

  it('returns false for moving opponent piece', () => {
    expect(isPremoveLegal(START_FEN, { from: 'e7', to: 'e5' })).toBe(false);
  });
});

describe('validatePremove', () => {
  it('returns the premove if legal', () => {
    const premove = { from: 'e2' as const, to: 'e4' as const };
    expect(validatePremove(START_FEN, premove)).toEqual(premove);
  });

  it('returns null if illegal', () => {
    const premove = { from: 'e2' as const, to: 'e1' as const };
    expect(validatePremove(START_FEN, premove)).toBeNull();
  });

  it('handles one premove at a time — second call replaces result', () => {
    const first = validatePremove(START_FEN, { from: 'e2', to: 'e4' });
    const second = validatePremove(START_FEN, { from: 'd2', to: 'd4' });
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second?.from).toBe('d2');
  });

  it('returns null and does not throw on invalid FEN', () => {
    expect(validatePremove('not-a-fen', { from: 'e2', to: 'e4' })).toBeNull();
  });
});

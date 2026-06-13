import { describe, it, expect } from 'vitest';
import { isSacrifice } from '@/lib/board/sacrifice';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('isSacrifice', () => {
  it('returns false for a quiet opening move (nothing hangs)', () => {
    expect(isSacrifice(START, 'e2e4')).toBe(false);
  });

  it('returns false for a clean, defended trade', () => {
    // Knights face off; NxN is recaptured by a pawn — even exchange, not a sac.
    const fen = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1';
    expect(isSacrifice(fen, 'f3e5')).toBe(false);
  });

  it('detects a quiet piece left en prise for free', () => {
    // White knight to d5 where a black pawn on c6 (and e6) can take it for nothing.
    const fen = '4k3/8/2p1p3/8/8/4N3/8/4K3 w - - 0 1';
    expect(isSacrifice(fen, 'e3d5')).toBe(true);
  });

  it('detects a queen sacrifice that only wins a pawn back', () => {
    // White queen captures the h7 pawn but the black king recaptures the queen.
    const fen = '6k1/5ppp/8/8/8/8/8/3Q2K1 w - - 0 1';
    expect(isSacrifice(fen, 'd1d8')).toBe(false); // d8 is safe — no sac
    const fen2 = '7k/5p1p/6p1/8/8/8/6PP/3Q2K1 w - - 0 1';
    // Qd1xd8?? is not possible here; test a real sac: Qh5xh7+ Kxh7.
    const fen3 = '7k/5p1p/6p1/7Q/8/8/6PP/6K1 w - - 0 1';
    expect(isSacrifice(fen3, 'h5h7')).toBe(true);
    void fen2;
  });

  it('returns false for an illegal move string', () => {
    expect(isSacrifice(START, 'e2e9')).toBe(false);
    expect(isSacrifice(START, 'zzzz')).toBe(false);
  });
});

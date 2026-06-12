import { describe, expect, it } from 'vitest';
import { legalSans, filterMoves, isFullMatch } from '@/lib/board/legal-sans';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// White pawn on e7 about to promote; kings tucked away in the h-corner.
const PROMO = '7k/4P3/8/8/8/8/8/7K w - - 0 1';

describe('legalSans', () => {
  it('returns all 20 legal moves from the start position', () => {
    const moves = legalSans(START);
    expect(moves).toHaveLength(20);
    const e4 = moves.find((m) => m.san === 'e4');
    expect(e4).toMatchObject({ uci: 'e2e4', from: 'e2', to: 'e4' });
    expect(e4?.promotion).toBeUndefined();
  });

  it('returns [] for an invalid FEN', () => {
    expect(legalSans('not a fen')).toEqual([]);
  });

  it('expands a promotion into one match per piece with UCI suffixes', () => {
    const moves = legalSans(PROMO);
    const promos = moves.filter((m) => m.from === 'e7');
    expect(promos.map((m) => m.uci).sort()).toEqual(['e7e8b', 'e7e8n', 'e7e8q', 'e7e8r']);
    expect(promos.map((m) => m.promotion).sort()).toEqual(['b', 'n', 'q', 'r']);
  });
});

describe('filterMoves', () => {
  const moves = legalSans(START);

  it('empty query returns every move, sorted by SAN', () => {
    const all = filterMoves(moves, '');
    expect(all).toHaveLength(20);
    const sans = all.map((m) => m.san);
    expect(sans).toEqual([...sans].sort((a, b) => a.localeCompare(b)));
  });

  it('"e4" matches exactly one move', () => {
    const out = filterMoves(moves, 'e4');
    expect(out).toHaveLength(1);
    expect(out[0].san).toBe('e4');
  });

  it('"N" matches the 4 knight moves, case-insensitively', () => {
    for (const q of ['N', 'n']) {
      const out = filterMoves(moves, q);
      expect(out.map((m) => m.san)).toEqual(['Na3', 'Nc3', 'Nf3', 'Nh3']);
    }
  });

  it('partial UCI "e2" matches both e-pawn pushes', () => {
    const out = filterMoves(moves, 'e2');
    expect(out.map((m) => m.uci).sort()).toEqual(['e2e3', 'e2e4']);
  });

  it('"e7e8" matches all four promotion UCIs', () => {
    const out = filterMoves(legalSans(PROMO), 'e7e8');
    expect(out.map((m) => m.uci).sort()).toEqual(['e7e8b', 'e7e8n', 'e7e8q', 'e7e8r']);
  });

  it('ignores check/mate suffixes when matching SAN', () => {
    const promoMoves = legalSans(PROMO);
    // e8=Q delivers check along the 8th rank, so the SAN carries a suffix.
    const out = filterMoves(promoMoves, 'e8=q');
    expect(out).toHaveLength(1);
    expect(out[0].uci).toBe('e7e8q');
  });
});

describe('isFullMatch', () => {
  const moves = legalSans(START);
  const e4 = moves.find((m) => m.san === 'e4')!;
  const nf3 = moves.find((m) => m.san === 'Nf3')!;

  it('accepts a complete SAN', () => {
    expect(isFullMatch(e4, 'e4')).toBe(true);
    expect(isFullMatch(nf3, 'nf3')).toBe(true);
  });

  it('accepts a 4-char UCI', () => {
    expect(isFullMatch(e4, 'e2e4')).toBe(true);
  });

  it('rejects 2-char partials', () => {
    expect(isFullMatch(nf3, 'nf')).toBe(false);
    expect(isFullMatch(e4, 'e2')).toBe(false);
  });
});

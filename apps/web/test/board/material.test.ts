import { describe, it, expect } from 'vitest';
import { computeMaterial } from '@/lib/board/material';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Black is missing one knight (b8 empty).
const BLACK_DOWN_KNIGHT_FEN = 'r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// White has two queens (a promotion shape) and is otherwise stripped down.
const WHITE_PROMOTED_FEN = 'QQ5k/8/8/8/8/8/8/6K1 w - - 0 1';

describe('computeMaterial', () => {
  it('reports no captures and zero advantage from the starting position', () => {
    const m = computeMaterial(START_FEN);
    expect(m.byWhite.pieces).toEqual([]);
    expect(m.byBlack.pieces).toEqual([]);
    expect(m.advantage).toBe(0);
  });

  it('credits White with a captured knight when Black is missing one', () => {
    const m = computeMaterial(BLACK_DOWN_KNIGHT_FEN);
    expect(m.byWhite.pieces).toEqual(['n']);
    expect(m.byWhite.value).toBe(3);
    expect(m.byBlack.pieces).toEqual([]);
    expect(m.advantage).toBe(3);
  });

  it('never reports negative captures when a side has promoted', () => {
    const m = computeMaterial(WHITE_PROMOTED_FEN);
    // No white queen should be reported as "captured" despite the extra one.
    expect(m.byBlack.pieces).not.toContain('q');
    expect(m.byBlack.value).toBeGreaterThanOrEqual(0);
    expect(m.byWhite.value).toBeGreaterThanOrEqual(0);
  });

  it('returns empty material for an invalid FEN instead of throwing', () => {
    const m = computeMaterial('not a fen');
    expect(m.byWhite.pieces).toEqual([]);
    expect(m.byBlack.pieces).toEqual([]);
    expect(m.advantage).toBe(0);
  });

  it('sorts captured pieces by value, queen first', () => {
    // Black missing a queen and a pawn → White's captures listed q before p.
    const fen = 'rnb1kbnr/ppppppp1/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const m = computeMaterial(fen);
    expect(m.byWhite.pieces).toEqual(['q', 'p']);
  });
});

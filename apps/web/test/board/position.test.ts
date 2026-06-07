import { describe, it, expect } from 'vitest';
import {
  getLegalMovesForSquare,
  isKingInCheck,
  getPieceAt,
  fenToColorToMove,
  isPromotion,
} from '@/lib/board/position';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const CHECK_FEN = '8/8/8/8/8/8/5q2/4K2k w - - 0 1';
const PAWN_PROMO_FEN = '8/P7/8/8/8/8/8/4K2k w - - 0 1';

describe('getLegalMovesForSquare', () => {
  it('returns e2 pawn destinations from starting position', () => {
    const dests = getLegalMovesForSquare(START_FEN, 'e2');
    expect(dests).toContain('e3');
    expect(dests).toContain('e4');
    expect(dests).toHaveLength(2);
  });

  it('returns empty for empty square', () => {
    const dests = getLegalMovesForSquare(START_FEN, 'e4');
    expect(dests).toHaveLength(0);
  });

  it('returns knight moves from starting position', () => {
    const dests = getLegalMovesForSquare(START_FEN, 'g1');
    expect(dests).toContain('f3');
    expect(dests).toContain('h3');
    expect(dests).toHaveLength(2);
  });
});

describe('isKingInCheck', () => {
  it('returns false for starting position', () => {
    expect(isKingInCheck(START_FEN)).toBe(false);
  });

  it('returns true when king is in check', () => {
    expect(isKingInCheck(CHECK_FEN)).toBe(true);
  });
});

describe('getPieceAt', () => {
  it('returns white pawn at e2', () => {
    const piece = getPieceAt(START_FEN, 'e2');
    expect(piece).not.toBeNull();
    expect(piece?.type).toBe('p');
    expect(piece?.color).toBe('w');
  });

  it('returns null for empty square', () => {
    expect(getPieceAt(START_FEN, 'e4')).toBeNull();
  });

  it('returns black rook at a8', () => {
    const piece = getPieceAt(START_FEN, 'a8');
    expect(piece?.type).toBe('r');
    expect(piece?.color).toBe('b');
  });
});

describe('fenToColorToMove', () => {
  it('returns w for starting position', () => {
    expect(fenToColorToMove(START_FEN)).toBe('w');
  });

  it('returns b after e4 e5', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
    expect(fenToColorToMove(fen)).toBe('w');
  });
});

describe('isPromotion', () => {
  it('returns true for white pawn moving to 8th rank', () => {
    expect(isPromotion('a7', 'a8', PAWN_PROMO_FEN)).toBe(true);
  });

  it('returns false for normal pawn move', () => {
    expect(isPromotion('e2', 'e4', START_FEN)).toBe(false);
  });

  it('returns false for non-pawn piece', () => {
    expect(isPromotion('e1', 'e2', START_FEN)).toBe(false);
  });
});

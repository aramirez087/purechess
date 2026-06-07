import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { getAnimationSquares } from '@/lib/board/animations';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function fenAfterMove(fen: string, from: string, to: string, promotion?: string): string {
  const chess = new Chess(fen);
  chess.move({ from, to, promotion });
  return chess.fen();
}

const AFTER_E4 = fenAfterMove(START_FEN, 'e2', 'e4');

const CASTLE_BEFORE = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5';
const CASTLE_AFTER = fenAfterMove(CASTLE_BEFORE, 'e1', 'g1');

const EP_BEFORE = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
const EP_AFTER = fenAfterMove(EP_BEFORE, 'e5', 'd6');

describe('getAnimationSquares', () => {
  it('returns from/to for normal pawn move', () => {
    const result = getAnimationSquares(START_FEN, AFTER_E4);
    expect(result).not.toBeNull();
    expect(result?.from).toBe('e2');
    expect(result?.to).toBe('e4');
  });

  it('returns null for identical positions', () => {
    const result = getAnimationSquares(START_FEN, START_FEN);
    expect(result).toBeNull();
  });

  it('returns rook squares for kingside castle', () => {
    const result = getAnimationSquares(CASTLE_BEFORE, CASTLE_AFTER);
    expect(result).not.toBeNull();
    expect(result?.rookFrom).toBe('h1');
    expect(result?.rookTo).toBe('f1');
  });

  it('returns capturedAt for en passant', () => {
    const result = getAnimationSquares(EP_BEFORE, EP_AFTER);
    expect(result).not.toBeNull();
    expect(result?.from).toBe('e5');
    expect(result?.to).toBe('d6');
    expect(result?.capturedAt).toBe('d5');
  });
});

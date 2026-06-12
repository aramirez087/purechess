import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { diffPositions } from '@/lib/board/anim-diff';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function fenAfterMove(fen: string, from: string, to: string, promotion?: string): string {
  const chess = new Chess(fen);
  chess.move({ from, to, promotion });
  return chess.fen();
}

const AFTER_E4 = fenAfterMove(START_FEN, 'e2', 'e4');

const CASTLE_BEFORE = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5';
const CASTLE_AFTER = fenAfterMove(CASTLE_BEFORE, 'e1', 'g1');

const LONG_CASTLE_BEFORE = 'r3kbnr/pppqpppp/2n5/3p1b2/3P1B2/2N5/PPPQPPPP/R3KBNR w KQkq - 6 5';
const LONG_CASTLE_AFTER = fenAfterMove(LONG_CASTLE_BEFORE, 'e1', 'c1');

const EP_BEFORE = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
const EP_AFTER = fenAfterMove(EP_BEFORE, 'e5', 'd6');

const CAPTURE_BEFORE = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const CAPTURE_AFTER = fenAfterMove(CAPTURE_BEFORE, 'e4', 'd5');

const PROMO_BEFORE = '8/4P3/8/8/8/2k5/8/2K5 w - - 0 1';
const PROMO_AFTER = fenAfterMove(PROMO_BEFORE, 'e7', 'e8', 'q');

const CAPTURE_PROMO_BEFORE = '3r4/4P3/8/8/8/2k5/8/2K5 w - - 0 1';
const CAPTURE_PROMO_AFTER = fenAfterMove(CAPTURE_PROMO_BEFORE, 'e7', 'd8', 'q');

describe('diffPositions', () => {
  it('returns from/to for a quiet pawn move', () => {
    const result = diffPositions(START_FEN, AFTER_E4);
    expect(result).not.toBeNull();
    expect(result?.from).toBe('e2');
    expect(result?.to).toBe('e4');
    expect(result?.capturedAt).toBeUndefined();
    expect(result?.rookFrom).toBeUndefined();
  });

  it('returns null for identical positions', () => {
    expect(diffPositions(START_FEN, START_FEN)).toBeNull();
  });

  it('returns capturedAt on the destination for a regular capture', () => {
    const result = diffPositions(CAPTURE_BEFORE, CAPTURE_AFTER);
    expect(result).not.toBeNull();
    expect(result?.from).toBe('e4');
    expect(result?.to).toBe('d5');
    expect(result?.capturedAt).toBe('d5');
  });

  it('returns capturedAt off the destination for en passant', () => {
    const result = diffPositions(EP_BEFORE, EP_AFTER);
    expect(result).not.toBeNull();
    expect(result?.from).toBe('e5');
    expect(result?.to).toBe('d6');
    expect(result?.capturedAt).toBe('d5');
  });

  it('returns king + rook squares for kingside castle', () => {
    const result = diffPositions(CASTLE_BEFORE, CASTLE_AFTER);
    expect(result).not.toBeNull();
    expect(result?.from).toBe('e1');
    expect(result?.to).toBe('g1');
    expect(result?.rookFrom).toBe('h1');
    expect(result?.rookTo).toBe('f1');
  });

  it('returns king + rook squares for queenside castle', () => {
    const result = diffPositions(LONG_CASTLE_BEFORE, LONG_CASTLE_AFTER);
    expect(result).not.toBeNull();
    expect(result?.from).toBe('e1');
    expect(result?.to).toBe('c1');
    expect(result?.rookFrom).toBe('a1');
    expect(result?.rookTo).toBe('d1');
  });

  it('matches a promotion to the vanished pawn', () => {
    const result = diffPositions(PROMO_BEFORE, PROMO_AFTER);
    expect(result).not.toBeNull();
    expect(result?.from).toBe('e7');
    expect(result?.to).toBe('e8');
    expect(result?.capturedAt).toBeUndefined();
  });

  it('handles a capture-promotion', () => {
    const result = diffPositions(CAPTURE_PROMO_BEFORE, CAPTURE_PROMO_AFTER);
    expect(result).not.toBeNull();
    expect(result?.from).toBe('e7');
    expect(result?.to).toBe('d8');
    expect(result?.capturedAt).toBe('d8');
  });

  it('returns null for a multi-ply jump', () => {
    const afterTwoPlies = fenAfterMove(AFTER_E4, 'e7', 'e5');
    expect(diffPositions(START_FEN, afterTwoPlies)).toBeNull();
  });

  it('animates backward navigation over a quiet move', () => {
    const result = diffPositions(AFTER_E4, START_FEN);
    expect(result).not.toBeNull();
    expect(result?.from).toBe('e4');
    expect(result?.to).toBe('e2');
  });

  it('returns null when a piece materializes (capture undo)', () => {
    expect(diffPositions(CAPTURE_AFTER, CAPTURE_BEFORE)).toBeNull();
  });

  it('returns null for garbage FEN', () => {
    expect(diffPositions('not-a-fen', AFTER_E4)).toBeNull();
    expect(diffPositions(START_FEN, 'nope/nope w - - 0 1')).toBeNull();
  });
});

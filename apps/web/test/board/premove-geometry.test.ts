import { describe, it, expect } from 'vitest';
import { getPremoveDestinations } from '@/lib/board/premove-geometry';

// White to move everywhere below, so BLACK pieces are the premovable side.
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Black to move — white pieces premovable.
const START_FEN_B = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';

describe('getPremoveDestinations', () => {
  it('returns [] for an empty square', () => {
    expect(getPremoveDestinations(START_FEN, 'e4')).toEqual([]);
  });

  it('returns [] for a piece whose side is to move', () => {
    expect(getPremoveDestinations(START_FEN, 'e2')).toEqual([]);
    expect(getPremoveDestinations(START_FEN_B, 'e7')).toEqual([]);
  });

  it('returns [] for garbage FEN', () => {
    expect(getPremoveDestinations('garbage', 'e2')).toEqual([]);
  });

  it('gives a black pawn single, double and both diagonals from its start rank', () => {
    const dests = getPremoveDestinations(START_FEN, 'e7');
    expect(dests.sort()).toEqual(['d6', 'e5', 'e6', 'f6']);
  });

  it('gives a white pawn forward and diagonals (no double off the start rank)', () => {
    // White pawn already on e4, black to move.
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const dests = getPremoveDestinations(fen, 'e4');
    expect(dests.sort()).toEqual(['d5', 'e5', 'f5']);
  });

  it('gives a knight its L-squares minus friendly-occupied ones', () => {
    const dests = getPremoveDestinations(START_FEN, 'g8');
    // e7 holds a friendly pawn — excluded; f6/h6 empty.
    expect(dests.sort()).toEqual(['f6', 'h6']);
  });

  it('lets sliders pass through blockers', () => {
    // Black rook a8 behind its own a7 pawn: friendly a7 excluded, but the
    // whole file beyond it (and the white a-pawn's square) is reachable.
    const dests = getPremoveDestinations(START_FEN, 'a8');
    expect(dests).toContain('a2'); // enemy pawn — premove capture
    expect(dests).toContain('a5'); // empty, beyond the friendly blocker
    expect(dests).not.toContain('a7'); // friendly pawn
    expect(dests).not.toContain('b8'); // friendly knight
  });

  it('gives the queen rook+bishop rays ignoring blockers', () => {
    const dests = getPremoveDestinations(START_FEN, 'd8');
    expect(dests).toContain('d1'); // straight through everything
    expect(dests).toContain('h4'); // diagonal through everything
    expect(dests).not.toContain('e7'); // friendly pawn
    expect(dests).not.toContain('c3'); // not on a ray
  });

  it('gives the king one step in every direction', () => {
    // Lone black king on e5, white to move.
    const fen = '8/8/8/4k3/8/8/4K3/8 w - - 0 1';
    const dests = getPremoveDestinations(fen, 'e5');
    expect(dests.sort()).toEqual(['d4', 'd5', 'd6', 'e4', 'e6', 'f4', 'f5', 'f6']);
  });

  it('includes castle squares only while the matching rook is home', () => {
    // Black king e8 with both rooks home, white to move.
    const bothRooks = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w kq - 0 1';
    const dests = getPremoveDestinations(bothRooks, 'e8');
    expect(dests).toContain('g8');
    expect(dests).toContain('c8');

    // Kingside rook gone — only queenside castle premove remains.
    const noKingside = 'r3k3/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w q - 0 1';
    const dests2 = getPremoveDestinations(noKingside, 'e8');
    expect(dests2).not.toContain('g8');
    expect(dests2).toContain('c8');
  });
});

import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { buildMoveAnnouncement } from '@/lib/board/sr-announce';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function fenAfterMoves(moves: string[]): string {
  const c = new Chess();
  for (const m of moves) c.move(m);
  return c.fen();
}

describe('buildMoveAnnouncement', () => {
  it('normal knight move', () => {
    const next = fenAfterMoves(['Nf3']);
    expect(buildMoveAnnouncement(START_FEN, next)).toBe('Knight to f3');
  });

  it('pawn advance', () => {
    const next = fenAfterMoves(['e4']);
    expect(buildMoveAnnouncement(START_FEN, next)).toBe('Pawn to e4');
  });

  it('returns null for same FEN', () => {
    expect(buildMoveAnnouncement(START_FEN, START_FEN)).toBeNull();
  });

  it('returns null for invalid FEN', () => {
    expect(buildMoveAnnouncement('invalid', 'bad')).toBeNull();
  });

  it('capture', () => {
    const c = new Chess();
    ['e4', 'd5'].forEach((m) => c.move(m));
    const prevFen = c.fen();
    c.move('exd5');
    expect(buildMoveAnnouncement(prevFen, c.fen())).toBe('Pawn takes d5');
  });

  it('capture + check', () => {
    // White queen d5 captures black rook b7 (diagonal), giving check on b-file
    // FEN: 1k6/1r6/8/3Q4/8/8/8/1K6 w - - 0 1
    const capFen = '1k6/1r6/8/3Q4/8/8/8/1K6 w - - 0 1';
    const c = new Chess(capFen);
    const prevFen = c.fen();
    c.move({ from: 'd5', to: 'b7' });
    const result = buildMoveAnnouncement(prevFen, c.fen());
    expect(result).toBe('Queen takes b7, check');
  });

  it('checkmate', () => {
    // Scholar's mate: e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#
    const c = new Chess();
    ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'].forEach((m) => c.move(m));
    const prevFen = c.fen();
    c.move('Qxf7#');
    const result = buildMoveAnnouncement(prevFen, c.fen());
    expect(result).toBe('Queen takes f7, checkmate');
  });

  it('castles kingside', () => {
    // Open files for kingside castling: e4 e5 Nf3 Nc6 Bc4 Bc5 O-O
    const c = new Chess();
    ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'].forEach((m) => c.move(m));
    const prevFen = c.fen();
    c.move('O-O');
    expect(buildMoveAnnouncement(prevFen, c.fen())).toBe('Castles kingside');
  });

  it('promotion to queen', () => {
    // White pawn on a7, black king far away, nothing blocking a8
    const promFen = '8/P6k/8/8/8/8/8/4K3 w - - 0 1';
    const c = new Chess(promFen);
    const prevFen = c.fen();
    c.move({ from: 'a7', to: 'a8', promotion: 'q' });
    expect(buildMoveAnnouncement(prevFen, c.fen())).toBe('Pawn to a8, promoting to Queen');
  });
});

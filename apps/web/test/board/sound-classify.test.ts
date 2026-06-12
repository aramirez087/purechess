import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { classifyMoveSound } from '@/lib/board/rules';

function fensAround(setupMoves: string[], move: string): [string, string] {
  const chess = new Chess();
  for (const m of setupMoves) chess.move(m);
  const prev = chess.fen();
  chess.move(move);
  return [prev, chess.fen()];
}

describe('classifyMoveSound', () => {
  it('classifies a quiet move', () => {
    const [prev, next] = fensAround([], 'e4');
    expect(classifyMoveSound(prev, next)).toBe('move');
  });

  it('classifies a capture', () => {
    const [prev, next] = fensAround(['e4', 'd5'], 'exd5');
    expect(classifyMoveSound(prev, next)).toBe('capture');
  });

  it('classifies kingside castling', () => {
    const [prev, next] = fensAround(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], 'O-O');
    expect(classifyMoveSound(prev, next)).toBe('castle');
  });

  it('classifies queenside castling', () => {
    const [prev, next] = fensAround(
      ['d4', 'd5', 'Nc3', 'Nc6', 'Bf4', 'Bf5', 'Qd2', 'Qd7'],
      'O-O-O',
    );
    expect(classifyMoveSound(prev, next)).toBe('castle');
  });

  it('classifies a promotion', () => {
    const prev = '8/P7/6k1/8/8/8/8/7K w - - 0 1';
    const chess = new Chess(prev);
    chess.move('a8=Q');
    expect(classifyMoveSound(prev, chess.fen())).toBe('promote');
  });

  it('prefers promote over capture on a capture-promotion', () => {
    const prev = '1r6/P7/6k1/8/8/8/8/7K w - - 0 1';
    const chess = new Chess(prev);
    chess.move('axb8=N');
    expect(classifyMoveSound(prev, chess.fen())).toBe('promote');
  });

  it('still prefers check over promotion', () => {
    const prev = '8/P7/8/8/8/8/8/k6K w - - 0 1';
    const chess = new Chess(prev);
    chess.move('a8=Q+');
    expect(classifyMoveSound(prev, chess.fen())).toBe('check');
  });
});

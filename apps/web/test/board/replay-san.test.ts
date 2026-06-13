import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { replaySanLine } from '@/lib/board/rules';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('replaySanLine', () => {
  it('returns the start position with a null last move for an empty line', () => {
    const line = replaySanLine([]);
    expect(line).not.toBeNull();
    expect(line!.fens).toEqual([START_FEN]);
    expect(line!.lastMoves).toEqual([null]);
  });

  it('produces a FEN and move squares for each ply', () => {
    const line = replaySanLine(['e4', 'e5', 'Nf3']);
    expect(line).not.toBeNull();
    // n plies → n+1 FENs (index 0 is the start).
    expect(line!.fens).toHaveLength(4);
    expect(line!.lastMoves).toHaveLength(4);
    expect(line!.lastMoves[0]).toBeNull();
    expect(line!.lastMoves[1]).toEqual({ from: 'e2', to: 'e4' });
    expect(line!.lastMoves[2]).toEqual({ from: 'e7', to: 'e5' });
    expect(line!.lastMoves[3]).toEqual({ from: 'g1', to: 'f3' });
  });

  it('matches a chess.js replay of the same SAN line', () => {
    const sans = ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'];
    const chess = new Chess();
    sans.forEach((s) => chess.move(s));
    const line = replaySanLine(sans);
    expect(line!.fens[line!.fens.length - 1]).toBe(chess.fen());
  });

  it('handles castling and promotion SAN', () => {
    const line = replaySanLine(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']);
    expect(line).not.toBeNull();
    expect(line!.lastMoves[7]).toEqual({ from: 'e1', to: 'g1' });
  });

  it('returns null when a SAN move is illegal', () => {
    expect(replaySanLine(['e4', 'e4'])).toBeNull();
    expect(replaySanLine(['not-a-move'])).toBeNull();
  });
});

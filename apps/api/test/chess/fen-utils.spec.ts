import { Chess } from 'chess.js';
import { fenPosition, halfmoveClock, startingFen, toFen } from '../../src/chess/engine/fen-utils';

describe('fen-utils', () => {
  it('startingFen returns known starting FEN', () => {
    expect(startingFen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });

  it('fenPosition strips halfmove and fullmove fields', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const result = fenPosition(fen);
    expect(result.split(' ')).toHaveLength(4);
    expect(result).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3');
  });

  it('halfmoveClock parses 0 from starting FEN', () => {
    expect(halfmoveClock(startingFen())).toBe(0);
  });

  it('halfmoveClock parses custom value', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 3 1';
    expect(halfmoveClock(fen)).toBe(3);
  });

  it('toFen round-trips known FEN', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
    const chess = new Chess(fen);
    expect(toFen(chess)).toBe(fen);
  });
});

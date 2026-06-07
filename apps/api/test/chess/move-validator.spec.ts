import { Chess } from 'chess.js';
import { validateMove } from '../../src/chess/engine/move-validator';

describe('move-validator', () => {
  it('accepts legal pawn push via UCI', () => {
    const chess = new Chess();
    const result = validateMove(chess, { uci: 'e2e4' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.san).toBe('e4');
      expect(result.uci).toBe('e2e4');
    }
  });

  it('accepts legal move via from/to object', () => {
    const chess = new Chess();
    const result = validateMove(chess, { from: 'e2', to: 'e4' });
    expect(result.ok).toBe(true);
  });

  it('rejects illegal move', () => {
    const chess = new Chess();
    const result = validateMove(chess, { uci: 'e2e5' });
    expect(result.ok).toBe(false);
  });

  it('rejects wrong turn (black piece on white turn)', () => {
    const chess = new Chess();
    const result = validateMove(chess, { uci: 'e7e5' });
    expect(result.ok).toBe(false);
  });

  it('rejects promotion without piece', () => {
    const chess = new Chess('8/4P3/8/8/8/8/8/4k1K1 w - - 0 1');
    const result = validateMove(chess, { from: 'e7', to: 'e8' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/promotion/i);
    }
  });

  it('accepts promotion with queen via UCI', () => {
    const chess = new Chess('8/4P3/8/8/8/8/8/4k1K1 w - - 0 1');
    const result = validateMove(chess, { uci: 'e7e8q' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.uci).toBe('e7e8q');
    }
  });

  it('accepts promotion with queen via from/to/promotion object', () => {
    const chess = new Chess('8/4P3/8/8/8/8/8/4k1K1 w - - 0 1');
    const result = validateMove(chess, { from: 'e7', to: 'e8', promotion: 'q' });
    expect(result.ok).toBe(true);
  });

  it('accepts castling kingside', () => {
    const chess = new Chess('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    const result = validateMove(chess, { uci: 'e1g1' });
    expect(result.ok).toBe(true);
  });

  it('rejects castling through check', () => {
    const chess = new Chess('4k3/8/8/8/8/5r2/8/R3K2R w KQ - 0 1');
    const result = validateMove(chess, { uci: 'e1g1' });
    expect(result.ok).toBe(false);
  });

  it('accepts legal en passant', () => {
    const chess = new Chess('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');
    const result = validateMove(chess, { uci: 'e5d6' });
    expect(result.ok).toBe(true);
  });

  it('rejects en passant that would expose king (horizontal pin)', () => {
    const chess = new Chess('8/8/8/r3PpK1/8/8/8/1k6 w - f6 0 2');
    const result = validateMove(chess, { uci: 'e5f6' });
    expect(result.ok).toBe(false);
  });

  it('rejects invalid UCI format (too short)', () => {
    const chess = new Chess();
    const result = validateMove(chess, { uci: 'e2' });
    expect(result.ok).toBe(false);
  });

  it('rejects move with no from/to and no uci', () => {
    const chess = new Chess();
    const result = validateMove(chess, {});
    expect(result.ok).toBe(false);
  });

  it('returns new Chess instance on success without mutating input', () => {
    const chess = new Chess();
    const fenBefore = chess.fen();
    const result = validateMove(chess, { uci: 'e2e4' });
    expect(result.ok).toBe(true);
    expect(chess.fen()).toBe(fenBefore);
    if (result.ok) {
      expect(result.newChess.fen()).not.toBe(fenBefore);
    }
  });

  it('rejects non-escaping move when king is in check', () => {
    const chess = new Chess('4k3/8/8/8/8/8/8/4Kq2 w - - 0 1');
    expect(chess.inCheck()).toBe(true);
    const result = validateMove(chess, { uci: 'e1d1' });
    expect(result.ok).toBe(false);
  });
});

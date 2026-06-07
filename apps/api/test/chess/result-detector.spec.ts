import { Chess } from 'chess.js';
import { GameResult, GameTermination } from '@purechess/shared';
import { makeClock } from '../../src/chess/engine/clock';
import { fenPosition } from '../../src/chess/engine/fen-utils';
import { detectResult } from '../../src/chess/engine/result-detector';

const NO_CLOCK = makeClock(3600000, 3600000, 0, 0);

describe('result-detector', () => {
  it('returns null for active game with no draw conditions', () => {
    const chess = new Chess();
    expect(detectResult(chess, [fenPosition(chess.fen())], NO_CLOCK, 0)).toBeNull();
  });

  it("detects checkmate (Scholar's mate)", () => {
    const chess = new Chess();
    chess.move('e4'); chess.move('e5');
    chess.move('Qh5'); chess.move('Nc6');
    chess.move('Bc4'); chess.move('Nf6');
    chess.move('Qxf7');
    const result = detectResult(chess, [fenPosition(chess.fen())], NO_CLOCK, 0);
    expect(result?.result).toBe(GameResult.WhiteWins);
    expect(result?.reason).toBe(GameTermination.Checkmate);
  });

  it('detects stalemate', () => {
    const chess = new Chess('5k2/5P2/5K2/8/8/8/8/8 b - - 0 1');
    const result = detectResult(chess, [fenPosition(chess.fen())], NO_CLOCK, 0);
    expect(result?.result).toBe(GameResult.Draw);
    expect(result?.reason).toBe(GameTermination.Stalemate);
  });

  it('detects KvK insufficient material', () => {
    const chess = new Chess('k7/8/8/8/8/8/8/7K w - - 0 1');
    const result = detectResult(chess, [fenPosition(chess.fen())], NO_CLOCK, 0);
    expect(result?.result).toBe(GameResult.Draw);
    expect(result?.reason).toBe(GameTermination.InsufficientMaterial);
  });

  it('detects KvKB insufficient material', () => {
    const chess = new Chess('k7/8/8/8/8/8/8/6BK w - - 0 1');
    const result = detectResult(chess, [fenPosition(chess.fen())], NO_CLOCK, 0);
    expect(result?.result).toBe(GameResult.Draw);
    expect(result?.reason).toBe(GameTermination.InsufficientMaterial);
  });

  it('detects KvKN insufficient material', () => {
    const chess = new Chess('k7/8/8/8/8/8/8/6NK w - - 0 1');
    const result = detectResult(chess, [fenPosition(chess.fen())], NO_CLOCK, 0);
    expect(result?.result).toBe(GameResult.Draw);
    expect(result?.reason).toBe(GameTermination.InsufficientMaterial);
  });

  it('detects threefold repetition', () => {
    const chess = new Chess();
    const fenHistory: string[] = [fenPosition(chess.fen())];

    for (let i = 0; i < 2; i++) {
      chess.move('Nf3'); fenHistory.push(fenPosition(chess.fen()));
      chess.move('Nf6'); fenHistory.push(fenPosition(chess.fen()));
      chess.move('Ng1'); fenHistory.push(fenPosition(chess.fen()));
      chess.move('Ng8'); fenHistory.push(fenPosition(chess.fen()));
    }

    const result = detectResult(chess, fenHistory, NO_CLOCK, 0);
    expect(result?.result).toBe(GameResult.Draw);
    expect(result?.reason).toBe(GameTermination.ThreefoldRepetition);
  });

  it('does not trigger threefold before third repetition', () => {
    const chess = new Chess();
    const fenHistory: string[] = [fenPosition(chess.fen())];

    chess.move('Nf3'); fenHistory.push(fenPosition(chess.fen()));
    chess.move('Nf6'); fenHistory.push(fenPosition(chess.fen()));
    chess.move('Ng1'); fenHistory.push(fenPosition(chess.fen()));
    chess.move('Ng8'); fenHistory.push(fenPosition(chess.fen()));

    const result = detectResult(chess, fenHistory, NO_CLOCK, 0);
    expect(result).toBeNull();
  });

  it('detects 50-move rule at halfmoveClock=100', () => {
    const chess = new Chess('k7/8/8/8/8/8/8/KR6 w - - 100 1');
    const result = detectResult(chess, [fenPosition(chess.fen())], NO_CLOCK, 0);
    expect(result?.result).toBe(GameResult.Draw);
    expect(result?.reason).toBe(GameTermination.FiftyMoveRule);
  });

  it('does not trigger 50-move at halfmoveClock=99', () => {
    const chess = new Chess('k7/8/8/8/8/8/8/KR6 w - - 99 1');
    const result = detectResult(chess, [fenPosition(chess.fen())], NO_CLOCK, 0);
    expect(result).toBeNull();
  });

  it('detects timeout for white when clock exhausted', () => {
    const clock = makeClock(0, 300000, 0, 1000000);
    const chess = new Chess();
    const result = detectResult(chess, [fenPosition(chess.fen())], clock, 1000001);
    expect(result?.result).toBe(GameResult.BlackWins);
    expect(result?.reason).toBe(GameTermination.Timeout);
  });

  it('detects timeout for black when clock exhausted', () => {
    const clock = makeClock(300000, 0, 0, 1000000);
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    const result = detectResult(chess, [fenPosition(chess.fen())], clock, 1000001);
    expect(result?.result).toBe(GameResult.WhiteWins);
    expect(result?.reason).toBe(GameTermination.Timeout);
  });
});

import { Chess } from 'chess.js';
import { Color, GameResult, GameTermination } from '@purechess/shared';
import { ClockSnapshot, isTimeout } from './clock';
import { halfmoveClock } from './fen-utils';

export type ResultPayload = { result: GameResult; reason: GameTermination };

export function detectResult(
  chess: Chess,
  fenHistory: string[],
  clock: ClockSnapshot,
  nowMs: number,
): ResultPayload | null {
  const sideToMove = chess.turn() as Color;
  const opponent: Color = sideToMove === 'w' ? 'b' : 'w';

  if (isTimeout(clock, nowMs, sideToMove)) {
    return {
      result: sideToMove === 'w' ? GameResult.BlackWins : GameResult.WhiteWins,
      reason: GameTermination.Timeout,
    };
  }

  if (chess.isCheckmate()) {
    return {
      result: opponent === 'w' ? GameResult.WhiteWins : GameResult.BlackWins,
      reason: GameTermination.Checkmate,
    };
  }

  if (chess.isStalemate()) {
    return { result: GameResult.Draw, reason: GameTermination.Stalemate };
  }

  if (chess.isInsufficientMaterial()) {
    return { result: GameResult.Draw, reason: GameTermination.InsufficientMaterial };
  }

  if (fenHistory.length > 0) {
    const currentKey = fenHistory[fenHistory.length - 1];
    const count = fenHistory.filter((k) => k === currentKey).length;
    if (count >= 3) {
      return { result: GameResult.Draw, reason: GameTermination.ThreefoldRepetition };
    }
  }

  if (halfmoveClock(chess.fen()) >= 100) {
    return { result: GameResult.Draw, reason: GameTermination.FiftyMoveRule };
  }

  return null;
}

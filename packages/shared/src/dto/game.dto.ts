import type { GameStatus, Move } from '../chess.js';
import type { GameResult, GameTermination } from '../game-result.js';
import type { TimeControl } from '../time-control.js';

export interface CreateGameDto {
  timeControl: TimeControl;
  color?: 'w' | 'b' | 'random';
}

export interface MakeMoveDto {
  gameId: string;
  move: Move;
}

export interface GameSummaryDto {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string;
  status: GameStatus;
  timeControl: TimeControl;
  result?: GameResult;
  termination?: GameTermination;
  startedAt?: string;
  endedAt?: string;
  pgn?: string;
}

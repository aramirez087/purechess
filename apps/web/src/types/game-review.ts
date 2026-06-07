import type { GameResult, GameTermination } from '@purchess/shared';
import type { TimeControl } from '@purchess/shared';
import type { WireMove } from '@purchess/shared';

export interface ReviewPlayer {
  id: string;
  username: string;
  rating: number;
}

export interface GameReview {
  id: string;
  white: ReviewPlayer;
  black: ReviewPlayer;
  moves: WireMove[];
  finalFen: string;
  pgn: string;
  result: GameResult;
  termination: GameTermination;
  timeControl: TimeControl;
  rated: boolean;
  startedAt: string;
}

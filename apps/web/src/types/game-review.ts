import type { GameResult, GameTermination } from '@purechess/shared';
import type { TimeControl } from '@purechess/shared';
import type { WireMove } from '@purechess/shared';
import type { AnalysisNode } from '@/lib/board/analysis-tree';

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
  /** Custom starting position (FEN). Omitted = standard initial position. */
  startFen?: string;
}

/**
 * A review whose outcome may be unknown — pasted PGN/FEN analysis on
 * /analyze. Every completed `GameReview` is assignable to this shape.
 */
export type AnalysisReview = Omit<GameReview, 'result' | 'termination'> &
  Partial<Pick<GameReview, 'result' | 'termination'>> & {
    /**
     * Variation-preserving move tree from PGN import. When present it takes
     * precedence over `moves` (which stays `[]` so flat consumers don't
     * crash); the mainline is each node's `children[0]`.
     */
    tree?: AnalysisNode;
  };

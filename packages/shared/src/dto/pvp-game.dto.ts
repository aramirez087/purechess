import type { ComputerClockDto } from './computer-game.dto';

export interface PvpPlayerDto {
  id: string;
  username: string;
}

/** Move submission for a live PvP game. */
export interface PvpMoveDto {
  /** UCI move. */
  move: string;
}

/**
 * Live PvP (friend-invite) game state, scoped to the requesting player.
 * Served by GET /api/games/:id/state and returned by the move/resign actions.
 */
export interface PvpGameStateDto {
  gameId: string;
  fen: string;
  pgn: string;
  /** 'invite_pending' | 'active' | 'completed' | 'aborted'. */
  status: string;
  white: PvpPlayerDto | null;
  black: PvpPlayerDto | null;
  /** Color of the requesting user. */
  yourColor: 'white' | 'black';
  /** Last move played, UCI. */
  lastMove: string | null;
  /** Plies played. */
  ply: number;
  result: string | null;
  resultReason: string | null;
  /** Serialized per-side clock; null for untimed games. */
  clock: ComputerClockDto | null;
  timeControlSeconds: number;
  incrementSeconds: number;
  /** Rated games feed Glicko-2 on completion. Optional for compat. */
  rated?: boolean;
}

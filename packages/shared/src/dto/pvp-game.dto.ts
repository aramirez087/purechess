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

/** Draw offer lifecycle action for a live PvP game. */
export interface PvpDrawActionDto {
  action: 'offer' | 'accept' | 'decline' | 'claim';
}

/** Rematch offer lifecycle action for a finished PvP game. */
export interface PvpRematchActionDto {
  action: 'offer' | 'accept' | 'decline';
}

/**
 * Rematch linkage on a finished game: the new game is created
 * `invite_pending` at offer time and activated on accept.
 */
export interface PvpRematchStateDto {
  /** Id of the linked rematch game. */
  gameId: string;
  /** Color (in THIS game) of the player who offered. */
  offeredBy: 'white' | 'black';
  status: 'pending' | 'accepted';
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
  /** Color with a pending draw offer; null/absent when none. */
  drawOfferedBy?: 'white' | 'black' | null;
  /** Pending/accepted rematch linked to this game; null/absent when none. */
  rematch?: PvpRematchStateDto | null;
}

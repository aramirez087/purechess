import type { GameState, Move } from './chess';
import type { GameResult, GameTermination } from './game-result';

export enum WsEvent {
  Connect = 'connect',
  Disconnect = 'disconnect',

  GameJoin = 'game:join',
  GameLeave = 'game:leave',
  GameState = 'game:state',
  GameMove = 'game:move',
  GameMoveAck = 'game:move:ack',
  GameMoveError = 'game:move:error',
  GameOver = 'game:over',
  GameDrawOffer = 'game:draw:offer',
  GameDrawAccept = 'game:draw:accept',
  GameDrawDecline = 'game:draw:decline',
  GameResign = 'game:resign',
  GameAbort = 'game:abort',
  GameClock = 'game:clock',
  GamePresence = 'game:presence',

  MatchFound = 'match:found',
  MatchmakingJoin = 'matchmaking:join',
  MatchmakingLeave = 'matchmaking:leave',
  MatchmakingStatus = 'matchmaking:status',

  InviteCreated = 'invite:created',
  InviteAccepted = 'invite:accepted',

  Error = 'error',
  Ping = 'ping',
  Pong = 'pong',
}

export interface WsGameJoinPayload {
  gameId: string;
}

export interface WsGameMovePayload {
  gameId: string;
  move: Move;
}

export interface WsMoveAckPayload {
  gameId: string;
  state: GameState;
}

export interface WsMoveErrorPayload {
  gameId: string;
  reason: string;
}

export interface WsGameOverPayload {
  gameId: string;
  result: GameResult;
  termination: GameTermination;
}

/**
 * Color-neutral live game state pushed to the `game:{id}` room whenever the
 * server persists a change (move, resignation, flag fall). Carries no
 * `yourColor`/player identities — clients merge it into the state they
 * fetched over REST. `serverNow` lets clients correct local clock skew when
 * draining the side-to-move's clock from `lastTickAt`.
 */
export interface WsGameStatePayload {
  gameId: string;
  serverNow: number;
  fen: string;
  pgn: string;
  status: string;
  lastMove: string | null;
  ply: number;
  result: string | null;
  resultReason: string | null;
  clock: {
    whiteMs: number;
    blackMs: number;
    lastTickAt: number;
    incrementMs?: number;
  } | null;
  /** Color with a pending draw offer; null/absent when none. */
  drawOfferedBy?: 'white' | 'black' | null;
  /** Pending/accepted rematch linked to this game; null/absent when none. */
  rematch?: {
    gameId: string;
    offeredBy: 'white' | 'black';
    status: 'pending' | 'accepted';
  } | null;
}

/** User ids currently connected to the game room. */
export interface WsGamePresencePayload {
  gameId: string;
  userIds: string[];
}

export interface WsMatchFoundPayload {
  gameId: string;
  color: 'w' | 'b';
  opponentId: string;
}

export interface WsInviteCreatedPayload {
  gameId: string;
  inviteUrl: string;
}

export interface WsInviteAcceptedPayload {
  gameId: string;
}

export interface WsErrorPayload {
  code: string;
  message: string;
}

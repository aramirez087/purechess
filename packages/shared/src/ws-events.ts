import type { GameState, Move } from './chess.js';
import type { GameResult, GameTermination } from './game-result.js';

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

import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import {
  WsEvent,
  type WsGameOverPayload,
  type WsGamePresencePayload,
  type WsGameStatePayload,
  type WsMatchFoundPayload,
} from '@purechess/shared';

export const gameRoom = (gameId: string) => `game:${gameId}`;
/** Per-user room; every authenticated socket joins it on handshake. */
export const userRoom = (userId: string) => `user:${userId}`;

/**
 * Emitter facade over the Socket.IO server. Domain services (GamesService)
 * inject this to push state to game rooms without depending on the gateway.
 * The gateway binds the server instance after init; until then (and in unit
 * tests) every emit is a safe no-op.
 */
@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  bindServer(server: Server): void {
    this.server = server;
  }

  emitGameState(gameId: string, payload: WsGameStatePayload): void {
    this.server?.to(gameRoom(gameId)).emit(WsEvent.GameState, payload);
  }

  emitGameOver(gameId: string, payload: WsGameOverPayload): void {
    this.server?.to(gameRoom(gameId)).emit(WsEvent.GameOver, payload);
  }

  emitGamePresence(gameId: string, payload: WsGamePresencePayload): void {
    this.server?.to(gameRoom(gameId)).emit(WsEvent.GamePresence, payload);
  }

  /** Push a matchmaking pairing to a player who is not in any game room yet. */
  emitMatchFound(userId: string, payload: WsMatchFoundPayload): void {
    this.server?.to(userRoom(userId)).emit(WsEvent.MatchFound, payload);
  }

  /** Distinct user ids currently connected to a game room. */
  async roomUserIds(gameId: string): Promise<string[]> {
    if (!this.server) return [];
    const sockets = await this.server.in(gameRoom(gameId)).fetchSockets();
    const ids = sockets
      .map((s) => (s.data as { userId?: string }).userId)
      .filter((id): id is string => typeof id === 'string');
    return [...new Set(ids)];
  }
}

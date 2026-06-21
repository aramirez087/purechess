import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { WsEvent, type WsErrorPayload, type WsGameJoinPayload } from '@purechess/shared';
import { SessionsService } from '../auth/sessions.service';
import { PrismaService } from '../database/prisma.service';
import { RealtimeService, gameRoom, userRoom } from './realtime.service';

const SESSION_COOKIE = 'purechess_session';
/** A client plays a handful of games at once at most; caps join-spam DB hits. */
const MAX_GAME_ROOMS_PER_SOCKET = 8;

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

interface SocketData {
  userId?: string;
  gameIds?: Set<string>;
}

/**
 * Live game push channel. Sockets authenticate with the same session cookie
 * as REST (parsed off the WS handshake), join per-game rooms after a
 * membership check, and receive `game:state` / `game:over` pushes emitted by
 * GamesService via RealtimeService on every persisted change. Presence is
 * room membership: joins, leaves and disconnects broadcast the connected
 * user ids so clients can show opponent connectivity.
 */
@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'https://purechess.com',
      'https://www.purechess.com',
      'https://purechess-web.fly.dev',
      process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000',
      process.env['WEB_URL'] ?? 'http://localhost:3000',
    ],
    credentials: true,
  },
  // Mobile backgrounding can vanish a peer with no TCP FIN. Socket.IO defaults
  // (25s ping / 20s timeout) leave a ghost in the room — and a stale presence
  // dot — for ~45s. 10s/10s caps dead-peer detection at ~20s worst case while
  // staying well clear of a healthy mobile client's heartbeat, so a briefly
  // stalled-but-alive socket on flaky wifi is not falsely dropped.
  pingInterval: 10_000,
  pingTimeout: 10_000,
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly sessions: SessionsService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server): void {
    this.realtimeService.bindServer(server);
    // Authenticate during the handshake, NOT in handleConnection: connection
    // hooks run concurrently with the first inbound messages, so an async
    // session lookup there races the client's game:join (which then sees no
    // userId and is silently dropped). Middleware completes before the
    // client's `connect` event fires.
    server.use(async (socket, next) => {
      const token = readCookie(socket.handshake.headers.cookie, SESSION_COOKIE);
      const result = token ? await this.sessions.lookupSession(token) : null;
      if (!result) {
        next(new Error('unauthorized'));
        return;
      }
      (socket.data as SocketData).userId = result.user.id;
      (socket.data as SocketData).gameIds = new Set();
      // The per-user room exists before the client's `connect` fires, so
      // user-targeted pushes (match found, invite accepted) can never race
      // the handshake. Joining here also keeps bug-223's lesson: no async
      // auth work in handleConnection.
      await socket.join(userRoom(result.user.id));
      next();
    });
  }

  handleConnection(): void {
    // Auth happens in the handshake middleware registered in afterInit.
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const data = socket.data as SocketData;
    if (!data.gameIds) return;
    // Rooms are already torn down on 'disconnect'; re-broadcast presence to
    // whoever is left in each game this socket had joined.
    for (const gameId of data.gameIds) {
      await this.broadcastPresence(gameId);
    }
  }

  @SubscribeMessage(WsEvent.GameJoin)
  async onGameJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: WsGameJoinPayload,
  ): Promise<void> {
    const data = socket.data as SocketData;
    const userId = data.userId;
    const gameId = payload?.gameId;
    if (!userId || !gameId) return;
    // Already joined — don't hit the DB or re-broadcast presence.
    if (data.gameIds?.has(gameId)) return;
    if ((data.gameIds?.size ?? 0) >= MAX_GAME_ROOMS_PER_SOCKET) {
      const error: WsErrorPayload = {
        code: 'game_join_limit',
        message: 'Too many game rooms on this connection',
      };
      socket.emit(WsEvent.Error, error);
      return;
    }

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { whiteUserId: true, blackUserId: true, isVsComputer: true },
    });
    if (
      !game ||
      game.isVsComputer ||
      (game.whiteUserId !== userId && game.blackUserId !== userId)
    ) {
      const error: WsErrorPayload = {
        code: 'game_join_denied',
        message: 'Not your game',
      };
      socket.emit(WsEvent.Error, error);
      return;
    }

    await socket.join(gameRoom(gameId));
    data.gameIds?.add(gameId);
    await this.broadcastPresence(gameId);
  }

  @SubscribeMessage(WsEvent.GameLeave)
  async onGameLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: WsGameJoinPayload,
  ): Promise<void> {
    const gameId = payload?.gameId;
    if (!gameId) return;
    await socket.leave(gameRoom(gameId));
    (socket.data as SocketData).gameIds?.delete(gameId);
    await this.broadcastPresence(gameId);
  }

  private async broadcastPresence(gameId: string): Promise<void> {
    const userIds = await this.realtimeService.roomUserIds(gameId);
    this.realtimeService.emitGamePresence(gameId, { gameId, userIds });
  }
}

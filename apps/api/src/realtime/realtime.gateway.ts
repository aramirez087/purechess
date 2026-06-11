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
import {
  WsEvent,
  type WsErrorPayload,
  type WsGameJoinPayload,
} from '@purechess/shared';
import { SessionsService } from '../auth/sessions.service';
import { PrismaService } from '../database/prisma.service';
import { RealtimeService, gameRoom } from './realtime.service';

const SESSION_COOKIE = 'purechess_session';

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
      'https://purechess-web.fly.dev',
      process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000',
      process.env['WEB_URL'] ?? 'http://localhost:3000',
    ],
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
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

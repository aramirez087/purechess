import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

const WsEvent = {
  InviteCreated: 'invite:created',
  InviteAccepted: 'invite:accepted',
} as const;

@WebSocketGateway({ cors: { origin: '*' } })
export class InviteGateway {
  @WebSocketServer()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server: any;

  emitInviteCreated(userId: string, payload: { gameId: string; inviteUrl: string }): void {
    this.server?.to(`user:${userId}`).emit(WsEvent.InviteCreated, payload);
  }

  emitInviteAccepted(
    creatorId: string,
    acceptorId: string,
    payload: { gameId: string },
  ): void {
    this.server?.to(`user:${creatorId}`).emit(WsEvent.InviteAccepted, payload);
    this.server?.to(`user:${acceptorId}`).emit(WsEvent.InviteAccepted, payload);
  }
}

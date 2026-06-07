import { WebSocketGateway } from '@nestjs/websockets';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway {
  constructor(private readonly realtimeService: RealtimeService) {}
}

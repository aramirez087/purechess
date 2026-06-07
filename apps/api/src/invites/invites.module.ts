import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { InviteGateway } from './invite-gateway';

@Module({
  imports: [AuthModule],
  controllers: [InvitesController],
  providers: [InvitesService, InviteGateway],
})
export class InvitesModule {}

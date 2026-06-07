import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InvitesService, InviteColor } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';

const VALID_COLORS = new Set<string>(['white', 'black', 'random']);

@Controller('invites')
export class InvitesController {
  constructor(
    private readonly invites: InvitesService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @UseGuards(SessionAuthGuard)
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateInviteDto,
    @Query('color') colorParam?: string,
  ) {
    const color: InviteColor =
      colorParam && VALID_COLORS.has(colorParam)
        ? (colorParam as InviteColor)
        : 'random';
    const appUrl = this.config.get<string>('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    return this.invites.createInvite(user.id, dto, color, appUrl);
  }

  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.invites.getInviteByToken(token);
  }

  @Post(':token/accept')
  @UseGuards(SessionAuthGuard)
  accept(@Param('token') token: string, @CurrentUser() user: { id: string }) {
    return this.invites.acceptInvite(token, user.id);
  }

  @Post(':token/cancel')
  @UseGuards(SessionAuthGuard)
  cancel(@Param('token') token: string, @CurrentUser() user: { id: string }) {
    return this.invites.cancelInvite(token, user.id);
  }
}

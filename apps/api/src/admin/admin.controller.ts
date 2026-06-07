import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuditService } from './audit.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListUsersDto } from './dto/list-users.dto';
import { ListGamesDto } from './dto/list-games.dto';
import { ListAuditDto } from './dto/list-audit.dto';
import { DisableUserDto } from './dto/disable-user.dto';
import type { User } from '@prisma/client';

@Controller('admin')
@UseGuards(SessionAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  @Get('users')
  listUsers(@Query() dto: ListUsersDto) {
    return this.adminService.listUsers(dto);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Post('users/:id/disable')
  disableUser(
    @Param('id') id: string,
    @Body() dto: DisableUserDto,
    @CurrentUser() admin: User,
  ) {
    return this.adminService.disableUser(admin.id, id, dto.reason);
  }

  @Post('users/:id/enable')
  enableUser(@Param('id') id: string, @CurrentUser() admin: User) {
    return this.adminService.enableUser(admin.id, id);
  }

  @Get('games')
  listGames(@Query() dto: ListGamesDto) {
    return this.adminService.listGames(dto);
  }

  @Get('games/:id')
  getGame(@Param('id') id: string) {
    return this.adminService.getGame(id);
  }

  @Get('queues')
  getQueues() {
    return this.adminService.getQueues();
  }

  @Get('active-games')
  getActiveGames() {
    return this.adminService.getActiveGames();
  }

  @Get('audit')
  listAudit(@Query() dto: ListAuditDto) {
    return this.adminService.listAudit(dto);
  }
}

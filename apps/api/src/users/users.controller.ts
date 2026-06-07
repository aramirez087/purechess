import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type { GameHistoryResponseDto, ProfileDto, SafeUser } from '@purchess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { OptionalSessionAuthGuard } from '../auth/guards/optional-session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/user-profile.dto';
import { GameHistoryQueryDto } from './dto/game-history.dto';

function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
  };
}

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  @UseGuards(SessionAuthGuard)
  async updateMe(
    @CurrentUser() user: User,
    @Body() dto: UpdateMeDto,
  ): Promise<{ user: SafeUser }> {
    const updated = await this.users.updateMe(user.id, dto);
    return { user: toSafeUser(updated) };
  }

  @Get(':username')
  @UseGuards(OptionalSessionAuthGuard)
  async getProfile(
    @Param('username') username: string,
    @CurrentUser() viewer: User | undefined,
  ): Promise<ProfileDto> {
    return this.users.getProfile(username, viewer?.id);
  }

  @Get(':username/games')
  @UseGuards(OptionalSessionAuthGuard)
  async getGameHistory(
    @Param('username') username: string,
    @Query() query: GameHistoryQueryDto,
    @CurrentUser() viewer: User | undefined,
  ): Promise<GameHistoryResponseDto> {
    return this.users.getGameHistory(username, query, viewer?.id);
  }
}

import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { TestingService } from './testing.service';

// These DTOs need class-validator decorators: the global ValidationPipe runs
// with `whitelist: true` + `forbidNonWhitelisted: true` (main.ts), so an
// undecorated property is treated as non-whitelisted and the request is
// rejected with 400 ("property X should not exist"). Without these the e2e
// testing endpoints (user/session/game seeding) 400 on every call. (S07)
class CreateUserDto {
  @IsString()
  username!: string;

  @IsString()
  email!: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}

class CreateSessionDto {
  @IsString()
  userId!: string;
}

class CreateGameDto {
  @IsOptional()
  @IsString()
  whiteUserId?: string;

  @IsOptional()
  @IsString()
  blackUserId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  timeControlSeconds?: number;

  @IsOptional()
  @IsInt()
  incrementSeconds?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isRated?: boolean;
}

@Controller('testing')
export class TestingController {
  constructor(private readonly testing: TestingService) {}

  private guardTestEnv(): void {
    if (process.env['NODE_ENV'] !== 'test') {
      throw new NotFoundException();
    }
  }

  @Post('users')
  async createUser(@Body() dto: CreateUserDto) {
    this.guardTestEnv();
    return this.testing.createUser(dto);
  }

  @Post('sessions')
  async createSession(@Body() dto: CreateSessionDto) {
    this.guardTestEnv();
    return this.testing.createSession(dto.userId);
  }

  @Post('games')
  async createGame(@Body() dto: CreateGameDto) {
    this.guardTestEnv();
    return this.testing.createGame(dto);
  }

  @Delete('reset')
  @HttpCode(HttpStatus.OK)
  async reset() {
    this.guardTestEnv();
    await this.testing.reset();
    return { ok: true };
  }
}

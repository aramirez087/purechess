import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { TestingService } from './testing.service';

class CreateUserDto {
  username!: string;
  email!: string;
  isAdmin?: boolean;
}

class CreateSessionDto {
  userId!: string;
}

class CreateGameDto {
  whiteUserId?: string;
  blackUserId?: string;
  status?: string;
  timeControlSeconds?: number;
  incrementSeconds?: number;
  category?: string;
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

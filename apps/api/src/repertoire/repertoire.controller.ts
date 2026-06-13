import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type {
  RepertoireDto,
  RepertoireSummaryDto,
} from '@purechess/shared';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RepertoireService } from './repertoire.service';
import {
  CreateRepertoireBodyDto,
  ImportRepertoireBodyDto,
  UpdateRepertoireBodyDto,
} from './dto/repertoire-body.dto';

/**
 * Opening-repertoire CRUD + import. Every route is auth-gated and scoped to the
 * current user — the service enforces ownership, so user A can never read or
 * mutate user B's repertoires.
 */
@Controller('repertoire')
@UseGuards(SessionAuthGuard)
export class RepertoireController {
  constructor(private readonly service: RepertoireService) {}

  /** The user's repertoires (summaries, no tree payload), newest first. */
  @Get()
  list(@CurrentUser() user: User): Promise<RepertoireSummaryDto[]> {
    return this.service.list(user.id);
  }

  /** Import a repertoire from a pre-parsed tree (preferred) or raw PGN. */
  @Post('import')
  @HttpCode(201)
  importRepertoire(
    @CurrentUser() user: User,
    @Body() dto: ImportRepertoireBodyDto,
  ): Promise<RepertoireDto> {
    return this.service.import(user.id, dto);
  }

  /** Create a repertoire from a pre-built tree. */
  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateRepertoireBodyDto,
  ): Promise<RepertoireDto> {
    return this.service.create(user.id, dto);
  }

  /** Full repertoire (with tree). 404 for a missing OR non-owned id. */
  @Get(':id')
  get(@CurrentUser() user: User, @Param('id') id: string): Promise<RepertoireDto> {
    return this.service.get(user.id, id);
  }

  /** Partial update (name/color/tree). */
  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateRepertoireBodyDto,
  ): Promise<RepertoireDto> {
    return this.service.update(user.id, id, dto);
  }

  /** Delete a repertoire (cascades its reviews). */
  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string): Promise<{ id: string }> {
    return this.service.remove(user.id, id);
  }
}

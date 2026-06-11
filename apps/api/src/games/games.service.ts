import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GameResult as PrismaGameResult, GameResultReason, Prisma } from '@prisma/client';
import {
  Color,
  GameResult,
  GameTermination,
  PvpDrawActionDto,
  PvpGameStateDto,
  PvpPlayerDto,
  PvpRematchActionDto,
  PvpRematchStateDto,
  SerializableEngineState,
  WsGameStatePayload,
} from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import { EngineService, InvalidMoveError } from '../chess/engine.service';
import { RealtimeService } from '../realtime/realtime.service';
import { RatingsService } from '../ratings/ratings.service';
import { PosthogService } from '../analytics/posthog.service';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { STARTING_FEN, engineTimeMs, isUntimed } from '../computer-games/computer-games.helpers';

const PLAYER_SELECT = { select: { id: true, username: true } } as const;

type LoadedGame = NonNullable<Awaited<ReturnType<GamesService['findGameWithPlayers']>>>;

/** Either player may abort while fewer than this many plies are on the board. */
const ABORT_PLY_LIMIT = 2;

function colorName(c: Color): 'white' | 'black' {
  return c === 'w' ? 'white' : 'black';
}

function resultTag(result: GameResult): '1-0' | '0-1' | '1/2-1/2' {
  if (result === GameResult.WhiteWins) return '1-0';
  if (result === GameResult.BlackWins) return '0-1';
  return '1/2-1/2';
}

/**
 * Live PvP (friend-invite) games. Mirrors the clock/persistence semantics of
 * ComputerGamesService: the server validates every move with the engine,
 * persists Move rows + engineState, and detects results — including idle flag
 * fall, which getState finalizes on poll so a player who never moves again
 * still loses on time.
 */
@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: EngineService,
    private readonly realtime: RealtimeService,
    private readonly ratings: RatingsService,
    private readonly posthog: PosthogService,
    private readonly matchmaking: MatchmakingService,
  ) {}

  /** Rating failures must never break a game-over response. */
  private async settleRatings(gameId: string): Promise<void> {
    try {
      await this.ratings.processGameResult(gameId);
    } catch (err) {
      this.logger.error(
        `Rating processing failed for game ${gameId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /** Public only so LoadedGame can be derived from its return type. */
  findGameWithPlayers(gameId: string) {
    return this.prisma.game.findUnique({
      where: { id: gameId },
      include: { whitePlayer: PLAYER_SELECT, blackPlayer: PLAYER_SELECT },
    });
  }

  private async loadGame(gameId: string, userId: string): Promise<LoadedGame> {
    const game = await this.findGameWithPlayers(gameId);
    if (!game) throw new NotFoundException('Game not found');
    if (game.isVsComputer)
      throw new BadRequestException('Not a PvP game — use the computer-game endpoints');
    if (game.whiteUserId !== userId && game.blackUserId !== userId) {
      throw new ForbiddenException('Not your game');
    }
    return game;
  }

  /**
   * Invite acceptance flips the game to `active` without creating engine
   * state; the first state fetch (either player) initializes it. The clock
   * starts at that moment, not at acceptance.
   */
  private async ensureEngineState(game: LoadedGame): Promise<SerializableEngineState> {
    const existing = game.engineState as unknown as SerializableEngineState | null;
    if (existing) return existing;

    const nowMs = Date.now();
    let state = this.engine.createGame({
      gameId: game.id,
      whiteUserId: game.whiteUserId,
      blackUserId: game.blackUserId,
      timeMs: engineTimeMs(game.timeControlSeconds),
      incrementMs: (game.incrementSeconds ?? 0) * 1000,
      nowMs,
    });
    state = { ...state, status: 'active' };
    const serialized = this.engine.toSerializable(state);

    await this.prisma.game.update({
      where: { id: game.id },
      data: { engineState: serialized as object, finalFen: STARTING_FEN },
    });
    return serialized;
  }

  private buildDto(
    game: LoadedGame,
    userId: string,
    serialized: SerializableEngineState | null,
    overrides?: {
      status?: string;
      result?: string | null;
      resultReason?: string | null;
      rematch?: PvpRematchStateDto | null;
    },
  ): PvpGameStateDto {
    const status = overrides?.status ?? game.status;
    const lastMove =
      serialized && serialized.moves.length > 0
        ? serialized.moves[serialized.moves.length - 1]!.uci
        : null;
    const clock =
      serialized && !isUntimed(game.timeControlSeconds)
        ? {
            whiteMs: serialized.clock.whiteMs,
            blackMs: serialized.clock.blackMs,
            lastTickAt: serialized.clock.lastTickAt,
            incrementMs: serialized.clock.incrementMs,
          }
        : null;

    return {
      gameId: game.id,
      fen: serialized?.fen ?? game.finalFen ?? STARTING_FEN,
      pgn: game.pgn ?? '',
      status,
      white: (game.whitePlayer as PvpPlayerDto | null) ?? null,
      black: (game.blackPlayer as PvpPlayerDto | null) ?? null,
      yourColor: game.whiteUserId === userId ? 'white' : 'black',
      lastMove,
      ply: serialized?.moves.length ?? 0,
      result: overrides?.result !== undefined ? overrides.result : (game.result ?? null),
      resultReason:
        overrides?.resultReason !== undefined
          ? overrides.resultReason
          : (game.resultReason ?? null),
      clock,
      timeControlSeconds: game.timeControlSeconds,
      incrementSeconds: game.incrementSeconds ?? 0,
      rated: game.isRated,
      drawOfferedBy: serialized?.pendingDrawOfferBy
        ? colorName(serialized.pendingDrawOfferBy)
        : null,
      rematch: overrides?.rematch ?? null,
    };
  }

  /**
   * Color-neutral push payload for the game room. Reuses buildDto for the
   * clock/lastMove serialization; the identity fields are discarded so one
   * emit serves both players.
   */
  private buildWsState(
    game: LoadedGame,
    serialized: SerializableEngineState | null,
    overrides?: Parameters<GamesService['buildDto']>[3],
  ): WsGameStatePayload {
    const dto = this.buildDto(game, game.whiteUserId ?? '', serialized, overrides);
    return {
      gameId: dto.gameId,
      serverNow: Date.now(),
      fen: dto.fen,
      pgn: dto.pgn,
      status: dto.status,
      lastMove: dto.lastMove,
      ply: dto.ply,
      result: dto.result,
      resultReason: dto.resultReason,
      clock: dto.clock,
      drawOfferedBy: dto.drawOfferedBy,
      rematch: dto.rematch,
    };
  }

  /** Rematch linkage as seen from `game` (the OLD game row). */
  private mapRematch(game: LoadedGame, rematchStatus: string | null): PvpRematchStateDto | null {
    if (!game.rematchGameId || !game.rematchOfferedBy || !rematchStatus) return null;
    const offeredBy = game.rematchOfferedBy === game.whiteUserId ? 'white' : 'black';
    if (rematchStatus === 'invite_pending')
      return { gameId: game.rematchGameId, offeredBy, status: 'pending' };
    if (rematchStatus === 'active')
      return { gameId: game.rematchGameId, offeredBy, status: 'accepted' };
    // Declined rematches are aborted — no live offer to show.
    return null;
  }

  private async loadRematchState(game: LoadedGame): Promise<PvpRematchStateDto | null> {
    if (!game.rematchGameId) return null;
    const linked = await this.prisma.game.findUnique({
      where: { id: game.rematchGameId },
      select: { status: true },
    });
    return this.mapRematch(game, linked?.status ?? null);
  }

  /**
   * Completes an active game: persists the result + a PGN carrying the real
   * result tag (resign/timeout/draw-agreement would otherwise export a stale
   * `*`), clears any pending draw offer, emits, settles ratings. The write is
   * guarded on `status: 'active'` so two completion paths racing (draw accept
   * vs flag fall vs resign) cannot double-finalize — the loser throws.
   */
  private async finalize(
    game: LoadedGame,
    serialized: SerializableEngineState,
    result: GameResult,
    reason: GameTermination,
    nowMs: number,
  ): Promise<{ state: SerializableEngineState; pgn: string }> {
    const completed: SerializableEngineState = {
      ...serialized,
      pendingDrawOfferBy: null,
      status: 'completed',
      result: result as SerializableEngineState['result'],
      resultReason: reason as SerializableEngineState['resultReason'],
    };
    const pgn = this.engine.buildPgn(completed.moves, {
      white: game.whitePlayer?.username ?? 'White',
      black: game.blackPlayer?.username ?? 'Black',
      result: resultTag(result),
    });
    const updated = await this.prisma.game.updateMany({
      where: { id: game.id, status: 'active' },
      data: {
        engineState: completed as object,
        status: 'completed',
        result: result as unknown as PrismaGameResult,
        resultReason: reason as unknown as GameResultReason,
        pgn,
        endedAt: new Date(nowMs),
      },
    });
    if (updated.count === 0) {
      throw new ConflictException('Game already ended');
    }
    const overrides = {
      status: 'completed',
      result: result as string,
      resultReason: reason as string,
    };
    this.realtime.emitGameState(game.id, this.buildWsState({ ...game, pgn }, completed, overrides));
    this.realtime.emitGameOver(game.id, {
      gameId: game.id,
      result,
      termination: reason,
    });
    await this.settleRatings(game.id);
    return { state: completed, pgn };
  }

  async getState(gameId: string, userId: string): Promise<PvpGameStateDto> {
    const game = await this.loadGame(gameId, userId);

    if (game.status !== 'active') {
      const serialized = (game.engineState as unknown as SerializableEngineState | null) ?? null;
      const rematch = await this.loadRematchState(game);
      return this.buildDto(game, userId, serialized, { rematch });
    }

    const serialized = await this.ensureEngineState(game);

    // Idle flag fall: a timed game where the side to move ran out without
    // submitting anything. Detected on poll so the opponent's client sees the
    // result without either player moving.
    if (!isUntimed(game.timeControlSeconds)) {
      const state = this.engine.fromSerializable(serialized);
      const nowMs = Date.now();
      const detected = await this.engine.detectResult(state, nowMs);
      if (detected && detected.reason === GameTermination.Timeout) {
        try {
          const done = await this.finalize(
            game,
            serialized,
            detected.result,
            detected.reason,
            nowMs,
          );
          return this.buildDto({ ...game, pgn: done.pgn }, userId, done.state, {
            status: 'completed',
            result: detected.result as string,
            resultReason: detected.reason as string,
          });
        } catch (err) {
          if (err instanceof ConflictException) {
            // Another path finalized first — serve the persisted truth.
            const fresh = await this.loadGame(gameId, userId);
            const freshSer =
              (fresh.engineState as unknown as SerializableEngineState | null) ?? null;
            return this.buildDto(fresh, userId, freshSer, {
              rematch: await this.loadRematchState(fresh),
            });
          }
          throw err;
        }
      }
    }

    return this.buildDto(game, userId, serialized);
  }

  async submitMove(gameId: string, userId: string, uci: string): Promise<PvpGameStateDto> {
    const game = await this.loadGame(gameId, userId);
    if (game.status !== 'active') throw new BadRequestException('Game is not active');

    const serialized = await this.ensureEngineState(game);
    const engineState = this.engine.fromSerializable(serialized);

    const yourColorChar = game.whiteUserId === userId ? 'w' : 'b';
    if (engineState.position.turn() !== yourColorChar) {
      throw new BadRequestException('Not your turn');
    }

    const nowMs = Date.now();
    if (isUntimed(game.timeControlSeconds)) {
      engineState.clock = { ...engineState.clock, lastTickAt: BigInt(nowMs) };
    }

    let state;
    try {
      state = await this.engine.applyMove(engineState, { uci }, nowMs);
    } catch (err) {
      if (err instanceof InvalidMoveError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    // Flag fall: applyMove returns the game completed WITHOUT appending the
    // attempted move (bug-005 semantics) — persist the timeout, no Move row.
    if (state.moves.length === engineState.moves.length) {
      const result = state.result as GameResult;
      const reason = state.resultReason as GameTermination;
      const done = await this.finalize(
        game,
        this.engine.toSerializable(state),
        result,
        reason,
        nowMs,
      );
      return this.buildDto({ ...game, pgn: done.pgn }, userId, done.state, {
        status: 'completed',
        result: result as string,
        resultReason: reason as string,
      });
    }

    const engineMove = state.moves[state.moves.length - 1]!;
    const finalResult = await this.engine.detectResult(state, nowMs);
    let serializedNext = this.engine.toSerializable(state);
    // Playing a move over the opponent's draw offer declines it implicitly;
    // the offerer's own move leaves their offer standing.
    if (serializedNext.pendingDrawOfferBy && serializedNext.pendingDrawOfferBy !== yourColorChar) {
      serializedNext = { ...serializedNext, pendingDrawOfferBy: null };
    }
    const finalFen = state.position.fen();

    const pgn = this.engine.buildPgn(state.moves, {
      white: game.whitePlayer?.username ?? 'White',
      black: game.blackPlayer?.username ?? 'Black',
      result: finalResult ? resultTag(finalResult.result) : '*',
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.move.create({
        data: {
          gameId,
          moveNumber: Math.ceil(engineMove.ply / 2),
          ply: engineMove.ply,
          userId,
          isComputer: false,
          san: engineMove.san,
          uci: engineMove.uci,
          fenAfterMove: engineMove.fenAfter,
          clockAfterMoveMs: engineMove.clockAfterMs,
          moveTimeMs: engineMove.moveTimeMs,
        },
      });

      await tx.game.update({
        where: { id: gameId },
        data: {
          engineState: serializedNext as object,
          finalFen,
          pgn,
          ...(finalResult
            ? {
                status: 'completed',
                result: finalResult.result as unknown as PrismaGameResult,
                resultReason: finalResult.reason as unknown as GameResultReason,
                endedAt: new Date(nowMs),
              }
            : {}),
        },
      });
    });

    const overrides = {
      status: finalResult ? 'completed' : 'active',
      result: finalResult ? (finalResult.result as string) : null,
      resultReason: finalResult ? (finalResult.reason as string) : null,
    };

    // Push the persisted state to the game room so the opponent sees the
    // move instantly instead of on the next poll.
    this.realtime.emitGameState(
      gameId,
      this.buildWsState({ ...game, pgn, finalFen }, serializedNext, overrides),
    );
    if (finalResult) {
      this.realtime.emitGameOver(gameId, {
        gameId,
        result: finalResult.result,
        termination: finalResult.reason,
      });
      await this.settleRatings(gameId);
    }

    return this.buildDto({ ...game, pgn, finalFen }, userId, serializedNext, overrides);
  }

  async resign(gameId: string, userId: string): Promise<PvpGameStateDto> {
    const game = await this.loadGame(gameId, userId);
    if (game.status !== 'active') throw new BadRequestException('Game is not active');

    const serialized = await this.ensureEngineState(game);
    const resignerIsWhite = game.whiteUserId === userId;
    const result = resignerIsWhite ? GameResult.BlackWins : GameResult.WhiteWins;
    const nowMs = Date.now();
    const done = await this.finalize(game, serialized, result, GameTermination.Resignation, nowMs);

    return this.buildDto({ ...game, pgn: done.pgn }, userId, done.state, {
      status: 'completed',
      result: result as string,
      resultReason: GameTermination.Resignation as string,
    });
  }

  // ---- Draw ----------------------------------------------------------------

  async draw(
    gameId: string,
    userId: string,
    action: PvpDrawActionDto['action'],
  ): Promise<PvpGameStateDto> {
    const game = await this.loadGame(gameId, userId);
    if (game.status !== 'active') throw new BadRequestException('Game is not active');

    const serialized = await this.ensureEngineState(game);
    const yourColorChar: Color = game.whiteUserId === userId ? 'w' : 'b';
    const nowMs = Date.now();
    const pending = serialized.pendingDrawOfferBy;

    if (action === 'offer') {
      if (pending === yourColorChar) throw new BadRequestException('Draw already offered');
      // Crossing offers mean both players want the draw — complete it.
      if (pending) return this.acceptDraw(game, userId, serialized, nowMs);
      const updated: SerializableEngineState = {
        ...serialized,
        pendingDrawOfferBy: yourColorChar,
      };
      const res = await this.prisma.game.updateMany({
        where: { id: gameId, status: 'active' },
        data: { engineState: updated as object },
      });
      if (res.count === 0) throw new ConflictException('Game already ended');
      this.realtime.emitGameState(gameId, this.buildWsState(game, updated));
      this.posthog.captureEvent(userId, 'pvp_draw_offered', {
        game_id: gameId,
        category: game.category,
      });
      return this.buildDto(game, userId, updated);
    }

    if (action === 'decline') {
      if (!pending || pending === yourColorChar)
        throw new BadRequestException('No draw offer to decline');
      const updated: SerializableEngineState = {
        ...serialized,
        pendingDrawOfferBy: null,
      };
      const res = await this.prisma.game.updateMany({
        where: { id: gameId, status: 'active' },
        data: { engineState: updated as object },
      });
      if (res.count === 0) throw new ConflictException('Game already ended');
      this.realtime.emitGameState(gameId, this.buildWsState(game, updated));
      this.posthog.captureEvent(userId, 'pvp_draw_declined', {
        game_id: gameId,
        category: game.category,
      });
      return this.buildDto(game, userId, updated);
    }

    if (action === 'accept') {
      if (!pending || pending === yourColorChar)
        throw new BadRequestException('No draw offer to accept');
      return this.acceptDraw(game, userId, serialized, nowMs);
    }

    // action === "claim": only a genuine, server-detected draw is honoured.
    const state = this.engine.fromSerializable(serialized);
    const detected = await this.engine.detectResult(state, nowMs);
    if (!detected || detected.result !== GameResult.Draw) {
      throw new BadRequestException('No draw to claim');
    }
    const done = await this.finalize(game, serialized, detected.result, detected.reason, nowMs);
    return this.buildDto({ ...game, pgn: done.pgn }, userId, done.state, {
      status: 'completed',
      result: detected.result as string,
      resultReason: detected.reason as string,
    });
  }

  private async acceptDraw(
    game: LoadedGame,
    userId: string,
    serialized: SerializableEngineState,
    nowMs: number,
  ): Promise<PvpGameStateDto> {
    const done = await this.finalize(
      game,
      serialized,
      GameResult.Draw,
      GameTermination.DrawAgreement,
      nowMs,
    );
    this.posthog.captureEvent(userId, 'pvp_draw_agreed', {
      game_id: game.id,
      category: game.category,
      rated: game.isRated,
    });
    return this.buildDto({ ...game, pgn: done.pgn }, userId, done.state, {
      status: 'completed',
      result: GameResult.Draw as string,
      resultReason: GameTermination.DrawAgreement as string,
    });
  }

  // ---- Abort ---------------------------------------------------------------

  async abort(gameId: string, userId: string): Promise<PvpGameStateDto> {
    const game = await this.loadGame(gameId, userId);
    if (game.status !== 'active') throw new BadRequestException('Game is not active');

    const serialized = (game.engineState as unknown as SerializableEngineState | null) ?? null;
    const plies = serialized?.moves.length ?? 0;
    if (plies >= ABORT_PLY_LIMIT) throw new BadRequestException('Cannot abort after move one');

    const nowMs = Date.now();
    const res = await this.prisma.game.updateMany({
      where: { id: gameId, status: 'active' },
      data: {
        status: 'aborted',
        result: null,
        resultReason: null,
        endedAt: new Date(nowMs),
      },
    });
    if (res.count === 0) throw new ConflictException('Game already ended');

    // No GameOver emit and no rating settlement — an abort has no result.
    this.realtime.emitGameState(gameId, this.buildWsState(game, serialized, { status: 'aborted' }));
    this.posthog.captureEvent(userId, 'pvp_game_aborted', {
      game_id: gameId,
      category: game.category,
    });
    return this.buildDto(game, userId, serialized, { status: 'aborted' });
  }

  // ---- Rematch ---------------------------------------------------------------

  async rematch(
    gameId: string,
    userId: string,
    action: PvpRematchActionDto['action'],
  ): Promise<PvpGameStateDto> {
    const game = await this.loadGame(gameId, userId);
    if (game.status !== 'completed' && game.status !== 'aborted')
      throw new BadRequestException('Game is still in progress');
    if (!game.whiteUserId || !game.blackUserId)
      throw new BadRequestException('Rematch needs both players');

    if (action === 'offer') return this.offerRematch(game, userId);
    if (action === 'accept') return this.acceptRematch(game, userId);
    return this.declineRematch(game, userId);
  }

  private async offerRematch(game: LoadedGame, userId: string): Promise<PvpGameStateDto> {
    if (game.rematchGameId) {
      if (game.rematchOfferedBy === userId) throw new ConflictException('Rematch already offered');
      // Both players clicked Rematch — that's consent.
      return this.acceptRematch(game, userId);
    }

    let created: string;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const next = await tx.game.create({
          data: {
            // Colors swap on rematch.
            whiteUserId: game.blackUserId,
            blackUserId: game.whiteUserId,
            timeControlSeconds: game.timeControlSeconds,
            incrementSeconds: game.incrementSeconds ?? 0,
            category: game.category,
            isRated: game.isRated,
            status: 'invite_pending',
          },
          select: { id: true },
        });
        const claimed = await tx.game.updateMany({
          where: { id: game.id, rematchGameId: null },
          data: { rematchGameId: next.id, rematchOfferedBy: userId },
        });
        // Lost the claim race — roll back the orphan game.
        if (claimed.count === 0) throw new ConflictException('Rematch already offered');
        return next.id;
      });
    } catch (err) {
      if (err instanceof ConflictException) {
        const fresh = await this.loadGame(game.id, userId);
        if (fresh.rematchGameId && fresh.rematchOfferedBy !== userId) {
          return this.acceptRematch(fresh, userId);
        }
      }
      throw err;
    }

    const serialized = (game.engineState as unknown as SerializableEngineState | null) ?? null;
    const rematch = this.mapRematch(
      { ...game, rematchGameId: created, rematchOfferedBy: userId },
      'invite_pending',
    );
    this.realtime.emitGameState(game.id, this.buildWsState(game, serialized, { rematch }));
    this.posthog.captureEvent(userId, 'pvp_rematch_offered', {
      game_id: game.id,
      rematch_game_id: created,
      category: game.category,
    });
    return this.buildDto(game, userId, serialized, { rematch });
  }

  private async acceptRematch(game: LoadedGame, userId: string): Promise<PvpGameStateDto> {
    if (!game.rematchGameId || !game.rematchOfferedBy)
      throw new BadRequestException('No rematch offer');
    if (game.rematchOfferedBy === userId) throw new BadRequestException('You offered this rematch');

    const activated = await this.prisma.game.updateMany({
      where: { id: game.rematchGameId, status: 'invite_pending' },
      data: { status: 'active', startedAt: new Date() },
    });
    if (activated.count === 0) {
      const linked = await this.prisma.game.findUnique({
        where: { id: game.rematchGameId },
        select: { status: true },
      });
      // Already activated (double accept) is idempotent success.
      if (linked?.status !== 'active') throw new ConflictException('Rematch no longer available');
    }

    // Either player may be sitting in the quick-match queue — remove them so
    // matchmaking cannot claim them into a second game. Best-effort.
    await this.matchmaking.dequeue(game.whiteUserId, game.blackUserId);

    const serialized = (game.engineState as unknown as SerializableEngineState | null) ?? null;
    const rematch = this.mapRematch(game, 'active');
    this.realtime.emitGameState(game.id, this.buildWsState(game, serialized, { rematch }));
    this.posthog.captureEvent(userId, 'pvp_rematch_accepted', {
      game_id: game.id,
      rematch_game_id: game.rematchGameId,
      category: game.category,
    });
    return this.buildDto(game, userId, serialized, { rematch });
  }

  private async declineRematch(game: LoadedGame, userId: string): Promise<PvpGameStateDto> {
    if (!game.rematchGameId) throw new BadRequestException('No rematch offer');

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Only an un-started rematch can be declined; an active one stands.
      const aborted = await tx.game.updateMany({
        where: { id: game.rematchGameId!, status: 'invite_pending' },
        data: { status: 'aborted', endedAt: new Date() },
      });
      if (aborted.count === 0) throw new ConflictException('Rematch already started');
      // Clearing the link lets either player offer again later.
      await tx.game.updateMany({
        where: { id: game.id },
        data: { rematchGameId: null, rematchOfferedBy: null },
      });
    });

    const serialized = (game.engineState as unknown as SerializableEngineState | null) ?? null;
    this.realtime.emitGameState(game.id, this.buildWsState(game, serialized, { rematch: null }));
    this.posthog.captureEvent(userId, 'pvp_rematch_declined', {
      game_id: game.id,
      category: game.category,
    });
    return this.buildDto(game, userId, serialized, { rematch: null });
  }
}

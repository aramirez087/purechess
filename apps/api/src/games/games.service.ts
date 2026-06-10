import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  GameResult as PrismaGameResult,
  GameResultReason,
} from "@prisma/client";
import {
  GameResult,
  GameTermination,
  PvpGameStateDto,
  PvpPlayerDto,
  SerializableEngineState,
} from "@purechess/shared";
import { PrismaService } from "../database/prisma.service";
import { EngineService, InvalidMoveError } from "../chess/engine.service";
import {
  STARTING_FEN,
  engineTimeMs,
  isUntimed,
} from "../computer-games/computer-games.helpers";

const PLAYER_SELECT = { select: { id: true, username: true } } as const;

type LoadedGame = NonNullable<
  Awaited<ReturnType<GamesService["findGameWithPlayers"]>>
>;

/**
 * Live PvP (friend-invite) games. Mirrors the clock/persistence semantics of
 * ComputerGamesService: the server validates every move with the engine,
 * persists Move rows + engineState, and detects results — including idle flag
 * fall, which getState finalizes on poll so a player who never moves again
 * still loses on time.
 */
@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: EngineService,
  ) {}

  /** Public only so LoadedGame can be derived from its return type. */
  findGameWithPlayers(gameId: string) {
    return this.prisma.game.findUnique({
      where: { id: gameId },
      include: { whitePlayer: PLAYER_SELECT, blackPlayer: PLAYER_SELECT },
    });
  }

  private async loadGame(gameId: string, userId: string): Promise<LoadedGame> {
    const game = await this.findGameWithPlayers(gameId);
    if (!game) throw new NotFoundException("Game not found");
    if (game.isVsComputer)
      throw new BadRequestException(
        "Not a PvP game — use the computer-game endpoints",
      );
    if (game.whiteUserId !== userId && game.blackUserId !== userId) {
      throw new ForbiddenException("Not your game");
    }
    return game;
  }

  /**
   * Invite acceptance flips the game to `active` without creating engine
   * state; the first state fetch (either player) initializes it. The clock
   * starts at that moment, not at acceptance.
   */
  private async ensureEngineState(
    game: LoadedGame,
  ): Promise<SerializableEngineState> {
    const existing =
      game.engineState as unknown as SerializableEngineState | null;
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
    state = { ...state, status: "active" };
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
      yourColor: game.whiteUserId === userId ? "white" : "black",
      lastMove,
      ply: serialized?.moves.length ?? 0,
      result:
        overrides?.result !== undefined ? overrides.result : (game.result ?? null),
      resultReason:
        overrides?.resultReason !== undefined
          ? overrides.resultReason
          : (game.resultReason ?? null),
      clock,
      timeControlSeconds: game.timeControlSeconds,
      incrementSeconds: game.incrementSeconds ?? 0,
    };
  }

  private async finalize(
    gameId: string,
    serialized: SerializableEngineState,
    result: GameResult,
    reason: GameTermination,
    nowMs: number,
  ): Promise<SerializableEngineState> {
    const completed: SerializableEngineState = {
      ...serialized,
      status: "completed",
      result: result as SerializableEngineState["result"],
      resultReason: reason as SerializableEngineState["resultReason"],
    };
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        engineState: completed as object,
        status: "completed",
        result: result as unknown as PrismaGameResult,
        resultReason: reason as unknown as GameResultReason,
        endedAt: new Date(nowMs),
      },
    });
    return completed;
  }

  async getState(gameId: string, userId: string): Promise<PvpGameStateDto> {
    const game = await this.loadGame(gameId, userId);

    if (game.status !== "active") {
      const serialized =
        (game.engineState as unknown as SerializableEngineState | null) ?? null;
      return this.buildDto(game, userId, serialized);
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
        const completed = await this.finalize(
          gameId,
          serialized,
          detected.result,
          detected.reason,
          nowMs,
        );
        return this.buildDto(game, userId, completed, {
          status: "completed",
          result: detected.result as string,
          resultReason: detected.reason as string,
        });
      }
    }

    return this.buildDto(game, userId, serialized);
  }

  async submitMove(
    gameId: string,
    userId: string,
    uci: string,
  ): Promise<PvpGameStateDto> {
    const game = await this.loadGame(gameId, userId);
    if (game.status !== "active")
      throw new BadRequestException("Game is not active");

    const serialized = await this.ensureEngineState(game);
    const engineState = this.engine.fromSerializable(serialized);

    const yourColorChar = game.whiteUserId === userId ? "w" : "b";
    if (engineState.position.turn() !== yourColorChar) {
      throw new BadRequestException("Not your turn");
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
      const completed = await this.finalize(
        gameId,
        this.engine.toSerializable(state),
        result,
        reason,
        nowMs,
      );
      return this.buildDto(game, userId, completed, {
        status: "completed",
        result: result as string,
        resultReason: reason as string,
      });
    }

    const engineMove = state.moves[state.moves.length - 1]!;
    const finalResult = await this.engine.detectResult(state, nowMs);
    const serializedNext = this.engine.toSerializable(state);
    const finalFen = state.position.fen();

    const pgn = this.engine.buildPgn(state.moves, {
      white: game.whitePlayer?.username ?? "White",
      black: game.blackPlayer?.username ?? "Black",
      result: finalResult
        ? finalResult.result === GameResult.WhiteWins
          ? "1-0"
          : finalResult.result === GameResult.BlackWins
            ? "0-1"
            : "1/2-1/2"
        : "*",
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
                status: "completed",
                result: finalResult.result as unknown as PrismaGameResult,
                resultReason:
                  finalResult.reason as unknown as GameResultReason,
                endedAt: new Date(nowMs),
              }
            : {}),
        },
      });
    });

    return this.buildDto({ ...game, pgn, finalFen }, userId, serializedNext, {
      status: finalResult ? "completed" : "active",
      result: finalResult ? (finalResult.result as string) : null,
      resultReason: finalResult ? (finalResult.reason as string) : null,
    });
  }

  async resign(gameId: string, userId: string): Promise<PvpGameStateDto> {
    const game = await this.loadGame(gameId, userId);
    if (game.status !== "active")
      throw new BadRequestException("Game is not active");

    const serialized = await this.ensureEngineState(game);
    const resignerIsWhite = game.whiteUserId === userId;
    const result = resignerIsWhite
      ? GameResult.BlackWins
      : GameResult.WhiteWins;
    const nowMs = Date.now();
    const completed = await this.finalize(
      gameId,
      serialized,
      result,
      GameTermination.Resignation,
      nowMs,
    );

    return this.buildDto(game, userId, completed, {
      status: "completed",
      result: result as string,
      resultReason: GameTermination.Resignation as string,
    });
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Chess } from "chess.js";
import {
  GameResult as PrismaGameResult,
  GameResultReason,
} from "@prisma/client";
import {
  ComputerGameStateDto,
  ComputerMoveDto,
  CreateComputerGameDto,
  CreateFromFenDto,
  GameResult,
  GameTermination,
  SerializableEngineState,
} from "@purechess/shared";
import { PrismaService } from "../database/prisma.service";
import { EngineService, InvalidMoveError } from "../chess/engine.service";
import { PosthogService } from "../analytics/posthog.service";
import {
  STARTING_FEN,
  buildStateDto,
  computeExtras,
  engineConfigFromDto,
  engineTimeMs,
  fenPositionKey,
  getCategory,
  isUntimed,
  readComputerEngineConfig,
  resolveColor,
  withPersistedEngineConfig,
} from "./computer-games.helpers";

@Injectable()
export class ComputerGamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: EngineService,
    private readonly posthog: PosthogService,
  ) {}

  async createGame(
    userId: string | null,
    dto: CreateComputerGameDto,
  ): Promise<ComputerGameStateDto> {
    const userColor = resolveColor(dto.color);
    const computerColor = userColor === "white" ? "black" : "white";

    const whiteUserId = userColor === "white" ? userId : null;
    const blackUserId = userColor === "black" ? userId : null;

    const nowMs = Date.now();
    const timeMs = engineTimeMs(dto.timeControlSeconds);
    const incrementMs = (dto.incrementSeconds ?? 0) * 1000;

    const game = await this.prisma.game.create({
      data: {
        whiteUserId,
        blackUserId,
        timeControlSeconds: dto.timeControlSeconds,
        incrementSeconds: dto.incrementSeconds ?? 0,
        category: getCategory(dto.timeControlSeconds),
        isRated: false,
        isVsComputer: true,
        computerLevel: dto.level,
        computerColor,
        status: "active",
        startedAt: new Date(nowMs),
        finalFen: STARTING_FEN,
        pgn: "",
      },
    });

    // Start the engine state at the opening position. The computer's move (if it
    // plays White) is computed client-side and submitted via submitMove — the
    // server no longer runs an engine.
    let engineState = this.engine.createGame({
      gameId: game.id,
      whiteUserId,
      blackUserId,
      timeMs,
      incrementMs,
      nowMs,
    });
    engineState = { ...engineState, status: "active" };

    const engineConfig = engineConfigFromDto(dto);
    const serialized = withPersistedEngineConfig(
      this.engine.toSerializable(engineState),
      engineConfig ? { computerEngine: engineConfig } : null,
    );

    await this.prisma.game.update({
      where: { id: game.id },
      data: {
        engineState: serialized as object,
        finalFen: STARTING_FEN,
      },
    });

    if (userId) {
      this.posthog.captureEvent(userId, "computer_game_created", {
        game_id: game.id,
        player_color: userColor,
        computer_level: dto.level,
        time_control_seconds: dto.timeControlSeconds,
        increment_seconds: dto.incrementSeconds ?? 0,
        category: getCategory(dto.timeControlSeconds),
      });
    }

    return buildStateDto({
      gameId: game.id,
      fen: STARTING_FEN,
      pgn: "",
      status: "active",
      computerColor,
      computerLevel: dto.level,
      lastComputerMove: null,
      result: null,
      resultReason: null,
      extras: computeExtras(serialized, computerColor, "active"),
      engineConfig: readComputerEngineConfig(serialized),
    });
  }

  async createGameFromFen(
    userId: string | null,
    dto: CreateFromFenDto,
  ): Promise<ComputerGameStateDto> {
    let chess: Chess;
    try {
      chess = new Chess(dto.fen);
    } catch {
      throw new BadRequestException("Invalid FEN");
    }
    const fen = chess.fen();

    const userColor = resolveColor(dto.color);
    const computerColor = userColor === "white" ? "black" : "white";
    const whiteUserId = userColor === "white" ? userId : null;
    const blackUserId = userColor === "black" ? userId : null;

    const nowMs = Date.now();
    const timeMs = engineTimeMs(dto.timeControlSeconds);
    const incrementMs = (dto.incrementSeconds ?? 0) * 1000;

    const game = await this.prisma.game.create({
      data: {
        whiteUserId,
        blackUserId,
        timeControlSeconds: dto.timeControlSeconds,
        incrementSeconds: dto.incrementSeconds ?? 0,
        category: getCategory(dto.timeControlSeconds),
        isRated: false,
        isVsComputer: true,
        computerLevel: dto.level,
        computerColor,
        status: "active",
        startedAt: new Date(nowMs),
        startingFen: fen,
        finalFen: fen,
        pgn: "",
      },
    });

    const engineConfig = engineConfigFromDto(dto);
    const serialized: SerializableEngineState = {
      gameId: game.id,
      whiteUserId,
      blackUserId,
      fen,
      fenHistory: [fenPositionKey(fen)],
      moves: [],
      pendingDrawOfferBy: null,
      clock: { whiteMs: timeMs, blackMs: timeMs, lastTickAt: nowMs, incrementMs },
      status: "active",
      result: null,
      resultReason: null,
      ...(engineConfig ? { computerEngine: engineConfig } : {}),
    };

    await this.prisma.game.update({
      where: { id: game.id },
      data: { engineState: serialized as object, finalFen: fen },
    });

    if (userId) {
      this.posthog.captureEvent(userId, "computer_game_created", {
        game_id: game.id,
        player_color: userColor,
        computer_level: dto.level,
        time_control_seconds: dto.timeControlSeconds,
        increment_seconds: dto.incrementSeconds ?? 0,
        category: getCategory(dto.timeControlSeconds),
        from_fen: true,
      });
    }

    return buildStateDto({
      gameId: game.id,
      fen,
      pgn: "",
      status: "active",
      computerColor,
      computerLevel: dto.level,
      lastComputerMove: null,
      result: null,
      resultReason: null,
      extras: computeExtras(serialized, computerColor, "active"),
      engineConfig: readComputerEngineConfig(serialized),
    });
  }

  async submitMove(
    gameId: string,
    userId: string | null,
    dto: ComputerMoveDto,
  ): Promise<ComputerGameStateDto> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException("Game not found");
    if (!game.isVsComputer)
      throw new BadRequestException("Not a computer game");
    if (game.status !== "active")
      throw new BadRequestException("Game is not active");
    if (game.whiteUserId !== userId && game.blackUserId !== userId) {
      throw new ForbiddenException("Not your game");
    }

    const gameComputerColor = game.computerColor as "white" | "black";
    const computerLevel = game.computerLevel ?? 1;
    const priorSerialized = game.engineState as unknown as SerializableEngineState | null;
    const engineConfig = readComputerEngineConfig(priorSerialized);
    const humanIsWhite = gameComputerColor === "black";

    if (dto.move === "resign") {
      // The human resigns; the computer wins.
      const result = humanIsWhite ? GameResult.BlackWins : GameResult.WhiteWins;
      const reason = GameTermination.Resignation;
      const nowMs = Date.now();

      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          status: "completed",
          result: result as unknown as PrismaGameResult,
          resultReason: reason as unknown as GameResultReason,
          endedAt: new Date(nowMs),
        },
      });

      if (userId) {
        this.posthog.captureEvent(userId, "computer_game_completed", {
          game_id: gameId,
          result: "loss",
          result_reason: "resignation",
          computer_level: computerLevel,
          category: game.category,
        });
      }

      return buildStateDto({
        gameId,
        fen: game.finalFen ?? STARTING_FEN,
        pgn: game.pgn,
        status: "completed",
        computerColor: gameComputerColor,
        computerLevel,
        lastComputerMove: game.lastComputerMove ?? null,
        result,
        resultReason: reason,
        extras: computeExtras(priorSerialized, gameComputerColor, "completed"),
        engineConfig,
      });
    }

    if (!game.engineState)
      throw new BadRequestException("Engine state missing");

    const engineState = this.engine.fromSerializable(
      game.engineState as unknown as SerializableEngineState,
    );

    // Whoever is to move is making this move. The endpoint applies exactly one
    // legal move (human or computer) — engine.applyMove rejects illegal ones.
    const computerColorChar = gameComputerColor === "white" ? "w" : "b";
    const isComputerMove = engineState.position.turn() === computerColorChar;

    const nowMs = Date.now();

    // Clock-aware move submission. For an untimed game (timeControlSeconds <= 0)
    // the UI presents the clock as "Unlimited", so the wall clock must never
    // flag the player: reset the tick origin to now before applying, so
    // isTimeout sees ~0 elapsed and never fires. For a timed game keep the
    // persisted lastTickAt so applyMove ticks real elapsed, applies increment,
    // and flag-fall (bug-005 path) can fire.
    if (isUntimed(game.timeControlSeconds)) {
      engineState.clock = { ...engineState.clock, lastTickAt: BigInt(nowMs) };
    }

    let state;
    try {
      state = await this.engine.applyMove(engineState, { uci: dto.move }, nowMs);
    } catch (err) {
      if (err instanceof InvalidMoveError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    // If the side to move flagged on time, applyMove returns the game as
    // completed WITHOUT appending the attempted move. Persist the timeout
    // result and return — there is no new move row to write, and reusing the
    // previous move would violate the (gameId, ply) unique constraint.
    if (state.moves.length === engineState.moves.length) {
      const result = state.result as string | null;
      const reason = state.resultReason as string | null;
      const serializedFlag = withPersistedEngineConfig(
        this.engine.toSerializable(state),
        priorSerialized,
      );

      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          engineState: serializedFlag as object,
          finalFen: state.position.fen(),
          status: "completed",
          result: state.result as unknown as PrismaGameResult,
          resultReason: state.resultReason as unknown as GameResultReason,
          endedAt: new Date(nowMs),
        },
      });

      return buildStateDto({
        gameId,
        fen: state.position.fen(),
        pgn: game.pgn,
        status: "completed",
        computerColor: gameComputerColor,
        computerLevel,
        lastComputerMove: game.lastComputerMove ?? null,
        result,
        resultReason: reason,
        extras: computeExtras(serializedFlag, gameComputerColor, "completed"),
        engineConfig,
      });
    }

    const engineMove = state.moves[state.moves.length - 1]!;

    const finalResult = await this.engine.detectResult(state, nowMs);
    const serialized = withPersistedEngineConfig(
      this.engine.toSerializable(state),
      priorSerialized,
    );
    const finalFen = state.position.fen();

    const pgn = this.engine.buildPgn(state.moves, {
      white: gameComputerColor === "white" ? "Computer" : "Player",
      black: gameComputerColor === "black" ? "Computer" : "Player",
      result: finalResult
        ? finalResult.result === GameResult.WhiteWins
          ? "1-0"
          : finalResult.result === GameResult.BlackWins
            ? "0-1"
            : "1/2-1/2"
        : "*",
    });

    const lastComputerMove = isComputerMove
      ? dto.move
      : (game.lastComputerMove ?? null);

    await this.prisma.$transaction(async (tx) => {
      await tx.move.create({
        data: {
          gameId,
          moveNumber: Math.ceil(engineMove.ply / 2),
          ply: engineMove.ply,
          userId: isComputerMove ? null : userId,
          isComputer: isComputerMove,
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
          engineState: serialized as object,
          finalFen,
          pgn,
          lastComputerMove,
          ...(finalResult
            ? {
                status: "completed",
                result: finalResult.result as unknown as PrismaGameResult,
                resultReason: finalResult.reason as unknown as GameResultReason,
                endedAt: new Date(nowMs),
              }
            : {}),
        },
      });
    });

    if (finalResult && userId) {
      let outcome: "win" | "loss" | "draw";
      if (finalResult.result === GameResult.Draw) {
        outcome = "draw";
      } else if (
        (humanIsWhite && finalResult.result === GameResult.WhiteWins) ||
        (!humanIsWhite && finalResult.result === GameResult.BlackWins)
      ) {
        outcome = "win";
      } else {
        outcome = "loss";
      }
      this.posthog.captureEvent(userId, "computer_game_completed", {
        game_id: gameId,
        result: outcome,
        result_reason: finalResult.reason as string,
        computer_level: computerLevel,
        category: game.category,
      });
    }

    return buildStateDto({
      gameId,
      fen: finalFen,
      pgn,
      status: finalResult ? "completed" : "active",
      computerColor: gameComputerColor,
      computerLevel,
      lastComputerMove,
      result: finalResult ? (finalResult.result as string) : null,
      resultReason: finalResult ? (finalResult.reason as string) : null,
      extras: computeExtras(
        serialized,
        gameComputerColor,
        finalResult ? "completed" : "active",
      ),
      engineConfig,
    });
  }

  async getGame(
    gameId: string,
    userId: string | null,
  ): Promise<ComputerGameStateDto> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException("Game not found");
    if (!game.isVsComputer)
      throw new BadRequestException("Not a computer game");
    if (game.whiteUserId !== userId && game.blackUserId !== userId) {
      throw new ForbiddenException("Not your game");
    }

    const computerColor = game.computerColor as "white" | "black";
    const serialized = game.engineState as unknown as SerializableEngineState | null;
    return buildStateDto({
      gameId: game.id,
      fen: game.finalFen ?? STARTING_FEN,
      pgn: game.pgn,
      status: game.status,
      computerColor,
      computerLevel: game.computerLevel ?? 1,
      lastComputerMove: game.lastComputerMove ?? null,
      result: game.result ?? null,
      resultReason: game.resultReason ?? null,
      extras: computeExtras(serialized, computerColor, game.status),
      engineConfig: readComputerEngineConfig(serialized),
    });
  }
}

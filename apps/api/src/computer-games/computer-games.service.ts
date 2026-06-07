import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  GameResult as PrismaGameResult,
  GameResultReason,
  TimeControlCategory,
} from "@prisma/client";
import {
  ComputerGameStateDto,
  ComputerMoveDto,
  CreateComputerGameDto,
  GameResult,
  GameTermination,
  SerializableEngineState,
} from "@purechess/shared";
import { PrismaService } from "../database/prisma.service";
import { EngineService, InvalidMoveError } from "../chess/engine.service";
import { PosthogService } from "../analytics/posthog.service";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function resolveColor(color: "white" | "black" | "random"): "white" | "black" {
  if (color === "random") return Math.random() < 0.5 ? "white" : "black";
  return color;
}

function getCategory(secs: number): TimeControlCategory {
  if (secs < 180) return TimeControlCategory.bullet;
  if (secs <= 600) return TimeControlCategory.blitz;
  return TimeControlCategory.rapid;
}

function toStateDto(
  gameId: string,
  fen: string,
  pgn: string | null,
  status: string,
  computerColor: "white" | "black",
  computerLevel: number,
  lastComputerMove: string | null,
  result: string | null,
  resultReason: string | null,
): ComputerGameStateDto {
  return {
    gameId,
    fen,
    pgn: pgn ?? "",
    status,
    computerColor,
    computerLevel,
    lastComputerMove,
    result,
    resultReason,
  };
}

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
    const timeMs = dto.timeControlSeconds * 1000;
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

    const serialized = this.engine.toSerializable(engineState);

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

    return toStateDto(
      game.id,
      STARTING_FEN,
      "",
      "active",
      computerColor,
      dto.level,
      null,
      null,
      null,
    );
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

      return toStateDto(
        gameId,
        game.finalFen ?? STARTING_FEN,
        game.pgn,
        "completed",
        gameComputerColor,
        computerLevel,
        game.lastComputerMove ?? null,
        result,
        reason,
      );
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

    let state;
    try {
      state = this.engine.applyMove(engineState, { uci: dto.move }, nowMs);
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

      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          engineState: this.engine.toSerializable(state) as object,
          finalFen: state.position.fen(),
          status: "completed",
          result: state.result as unknown as PrismaGameResult,
          resultReason: state.resultReason as unknown as GameResultReason,
          endedAt: new Date(nowMs),
        },
      });

      return toStateDto(
        gameId,
        state.position.fen(),
        game.pgn,
        "completed",
        gameComputerColor,
        computerLevel,
        game.lastComputerMove ?? null,
        result,
        reason,
      );
    }

    const engineMove = state.moves[state.moves.length - 1]!;

    const finalResult = this.engine.detectResult(state, nowMs);
    const serialized = this.engine.toSerializable(state);
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

    return toStateDto(
      gameId,
      finalFen,
      pgn,
      finalResult ? "completed" : "active",
      gameComputerColor,
      computerLevel,
      lastComputerMove,
      finalResult ? (finalResult.result as string) : null,
      finalResult ? (finalResult.reason as string) : null,
    );
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

    return toStateDto(
      game.id,
      game.finalFen ?? STARTING_FEN,
      game.pgn,
      game.status,
      game.computerColor as "white" | "black",
      game.computerLevel ?? 1,
      game.lastComputerMove ?? null,
      game.result ?? null,
      game.resultReason ?? null,
    );
  }
}

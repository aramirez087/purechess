import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Game } from "@prisma/client";
import {
  GameResult as PrismaGameResult,
  GameResultReason,
} from "@prisma/client";
import {
  Color,
  ComputerGameStateDto,
  CreateComputerGameDto,
  DrawActionDto,
  GameResult,
  GameTermination,
  SerializableEngineState,
} from "@purechess/shared";
import { PrismaService } from "../database/prisma.service";
import { EngineService } from "../chess/engine.service";
import { PosthogService } from "../analytics/posthog.service";
import { ComputerGamesService } from "./computer-games.service";
import {
  STARTING_FEN,
  buildStateDto,
  computeExtras,
  truncateToPly,
} from "./computer-games.helpers";

/**
 * State-mutating vs-computer actions that are NOT a normal move: takeback,
 * rewind, abort, draw (offer/accept/decline/claim) and rematch. The core
 * submitMove / createGame / getGame stay in ComputerGamesService. The server is
 * authoritative — every action validates ownership and game state, and writes
 * are transactional where row integrity matters (takeback/rewind delete Move
 * rows rather than re-inserting over the UNIQUE (gameId, ply) constraint).
 */
@Injectable()
export class ComputerGameActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: EngineService,
    private readonly posthog: PosthogService,
    private readonly computerGames: ComputerGamesService,
  ) {}

  private async loadGame(
    gameId: string,
    userId: string | null,
  ): Promise<Game> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException("Game not found");
    if (!game.isVsComputer)
      throw new BadRequestException("Not a computer game");
    if (game.whiteUserId !== userId && game.blackUserId !== userId) {
      throw new ForbiddenException("Not your game");
    }
    return game;
  }

  private humanUserId(game: Game): string | null {
    return game.computerColor === "white"
      ? game.blackUserId
      : game.whiteUserId;
  }

  // ---- Takeback / Rewind -------------------------------------------------

  async takeback(
    gameId: string,
    userId: string | null,
    plies: 1 | 2,
  ): Promise<ComputerGameStateDto> {
    const game = await this.loadGame(gameId, userId);
    if (!game.engineState)
      throw new BadRequestException("Engine state missing");
    const serialized = game.engineState as unknown as SerializableEngineState;
    const targetPly = serialized.moves.length - plies;
    if (targetPly < 0) throw new BadRequestException("Nothing to take back");
    return this.applyTruncation(game, serialized, targetPly);
  }

  async rewind(
    gameId: string,
    userId: string | null,
    ply: number,
  ): Promise<ComputerGameStateDto> {
    const game = await this.loadGame(gameId, userId);
    if (!game.engineState)
      throw new BadRequestException("Engine state missing");
    const serialized = game.engineState as unknown as SerializableEngineState;
    if (ply < 0 || ply >= serialized.moves.length) {
      throw new BadRequestException("Ply out of range");
    }
    return this.applyTruncation(game, serialized, ply);
  }

  private async applyTruncation(
    game: Game,
    serialized: SerializableEngineState,
    targetPly: number,
  ): Promise<ComputerGameStateDto> {
    const nowMs = Date.now();
    const truncated = truncateToPly(serialized, targetPly, game, nowMs);

    const computerColor = game.computerColor as "white" | "black";
    const computerColorChar: Color = computerColor === "white" ? "w" : "b";
    const fen = truncated.fen;

    const pgn = this.engine.buildPgn(truncated.moves, {
      white: computerColor === "white" ? "Computer" : "Player",
      black: computerColor === "black" ? "Computer" : "Player",
      result: "*",
    });

    let lastComputerMove: string | null = null;
    for (let i = truncated.moves.length - 1; i >= 0; i--) {
      if (truncated.moves[i]!.by === computerColorChar) {
        lastComputerMove = truncated.moves[i]!.uci;
        break;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.move.deleteMany({
        where: { gameId: game.id, ply: { gt: targetPly } },
      });
      await tx.game.update({
        where: { id: game.id },
        data: {
          engineState: truncated as object,
          finalFen: fen,
          pgn,
          lastComputerMove,
          status: "active",
          result: null,
          resultReason: null,
          endedAt: null,
        },
      });
    });

    return buildStateDto({
      gameId: game.id,
      fen,
      pgn,
      status: "active",
      computerColor,
      computerLevel: game.computerLevel ?? 1,
      lastComputerMove,
      result: null,
      resultReason: null,
      extras: computeExtras(truncated, computerColor, "active"),
    });
  }

  // ---- Abort -------------------------------------------------------------

  async abort(
    gameId: string,
    userId: string | null,
  ): Promise<ComputerGameStateDto> {
    const game = await this.loadGame(gameId, userId);
    if (game.status !== "active")
      throw new BadRequestException("Game is not active");

    const computerColor = game.computerColor as "white" | "black";
    const humanColorChar: Color = computerColor === "white" ? "b" : "w";
    const serialized =
      (game.engineState as unknown as SerializableEngineState | null) ?? null;
    const humanMoves = serialized
      ? serialized.moves.filter((m) => m.by === humanColorChar).length
      : 0;
    if (humanMoves > 0)
      throw new BadRequestException("Cannot abort after a move");

    const nowMs = Date.now();
    await this.prisma.game.update({
      where: { id: game.id },
      data: {
        status: "aborted",
        result: null,
        resultReason: null,
        endedAt: new Date(nowMs),
      },
    });

    const humanId = this.humanUserId(game);
    if (humanId) {
      this.posthog.captureEvent(humanId, "computer_game_aborted", {
        game_id: game.id,
        computer_level: game.computerLevel ?? 1,
        category: game.category,
      });
    }

    return buildStateDto({
      gameId: game.id,
      fen: game.finalFen ?? STARTING_FEN,
      pgn: game.pgn,
      status: "aborted",
      computerColor,
      computerLevel: game.computerLevel ?? 1,
      lastComputerMove: game.lastComputerMove ?? null,
      result: null,
      resultReason: null,
      extras: computeExtras(serialized, computerColor, "aborted"),
    });
  }

  // ---- Draw --------------------------------------------------------------

  async draw(
    gameId: string,
    userId: string | null,
    action: DrawActionDto["action"],
  ): Promise<ComputerGameStateDto> {
    const game = await this.loadGame(gameId, userId);
    if (!game.engineState)
      throw new BadRequestException("Engine state missing");
    if (game.status !== "active")
      throw new BadRequestException("Game is not active");

    const serialized = game.engineState as unknown as SerializableEngineState;
    const computerColor = game.computerColor as "white" | "black";
    const humanColorChar: Color = computerColor === "white" ? "b" : "w";
    const nowMs = Date.now();

    if (action === "offer") {
      const updated: SerializableEngineState = {
        ...serialized,
        pendingDrawOfferBy: humanColorChar,
      };
      await this.prisma.game.update({
        where: { id: game.id },
        data: { engineState: updated as object },
      });
      return this.activeDto(game, updated);
    }

    if (action === "decline") {
      const updated: SerializableEngineState = {
        ...serialized,
        pendingDrawOfferBy: null,
      };
      await this.prisma.game.update({
        where: { id: game.id },
        data: { engineState: updated as object },
      });
      return this.activeDto(game, updated);
    }

    if (action === "accept") {
      if (!serialized.pendingDrawOfferBy)
        throw new BadRequestException("No draw offer to accept");
      return this.completeDraw(
        game,
        serialized,
        GameResult.Draw,
        GameTermination.DrawAgreement,
        nowMs,
      );
    }

    // action === "claim": only a genuine, server-detected draw is honoured.
    const state = this.engine.fromSerializable(serialized);
    const detected = this.engine.detectResult(state, nowMs);
    if (!detected || detected.result !== GameResult.Draw) {
      throw new BadRequestException("No draw to claim");
    }
    return this.completeDraw(
      game,
      serialized,
      detected.result,
      detected.reason,
      nowMs,
    );
  }

  private async completeDraw(
    game: Game,
    serialized: SerializableEngineState,
    result: GameResult,
    reason: GameTermination,
    nowMs: number,
  ): Promise<ComputerGameStateDto> {
    const updated: SerializableEngineState = {
      ...serialized,
      pendingDrawOfferBy: null,
      status: "completed",
      result,
      resultReason: reason,
    };
    await this.prisma.game.update({
      where: { id: game.id },
      data: {
        engineState: updated as object,
        status: "completed",
        result: result as unknown as PrismaGameResult,
        resultReason: reason as unknown as GameResultReason,
        endedAt: new Date(nowMs),
      },
    });

    const humanId = this.humanUserId(game);
    if (humanId) {
      this.posthog.captureEvent(humanId, "computer_game_completed", {
        game_id: game.id,
        result: "draw",
        result_reason: reason as string,
        computer_level: game.computerLevel ?? 1,
        category: game.category,
      });
    }

    const computerColor = game.computerColor as "white" | "black";
    return buildStateDto({
      gameId: game.id,
      fen: game.finalFen ?? STARTING_FEN,
      pgn: game.pgn,
      status: "completed",
      computerColor,
      computerLevel: game.computerLevel ?? 1,
      lastComputerMove: game.lastComputerMove ?? null,
      result: result as string,
      resultReason: reason as string,
      extras: computeExtras(updated, computerColor, "completed"),
    });
  }

  private activeDto(
    game: Game,
    serialized: SerializableEngineState,
  ): ComputerGameStateDto {
    const computerColor = game.computerColor as "white" | "black";
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
    });
  }

  // ---- Rematch -----------------------------------------------------------

  async rematch(
    gameId: string,
    userId: string | null,
    swapColors?: boolean,
  ): Promise<ComputerGameStateDto> {
    const game = await this.loadGame(gameId, userId);
    const computerColor = game.computerColor as "white" | "black";
    let humanColor: "white" | "black" =
      computerColor === "white" ? "black" : "white";
    if (swapColors) humanColor = humanColor === "white" ? "black" : "white";

    const dto: CreateComputerGameDto = {
      level: (game.computerLevel ?? 1) as CreateComputerGameDto["level"],
      color: humanColor,
      timeControlSeconds: game.timeControlSeconds,
      incrementSeconds: game.incrementSeconds ?? 0,
    };
    return this.computerGames.createGame(userId, dto);
  }
}

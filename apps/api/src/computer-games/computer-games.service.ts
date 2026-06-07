import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GameResult as PrismaGameResult, GameResultReason, TimeControlCategory } from '@prisma/client';
import {
  ComputerGameStateDto,
  ComputerMoveDto,
  CreateComputerGameDto,
  GameResult,
  GameTermination,
  SerializableEngineState,
} from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import { EngineService } from '../chess/engine.service';
import { StockfishService } from './stockfish.service';
import { PosthogService } from '../analytics/posthog.service';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function resolveColor(color: 'white' | 'black' | 'random'): 'white' | 'black' {
  if (color === 'random') return Math.random() < 0.5 ? 'white' : 'black';
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
  computerColor: 'white' | 'black',
  lastComputerMove: string | null,
  result: string | null,
  resultReason: string | null,
): ComputerGameStateDto {
  return {
    gameId,
    fen,
    pgn: pgn ?? '',
    status,
    computerColor,
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
    private readonly stockfish: StockfishService,
    private readonly posthog: PosthogService,
  ) {}

  async createGame(userId: string | null, dto: CreateComputerGameDto): Promise<ComputerGameStateDto> {
    const userColor = resolveColor(dto.color);
    const computerColor = userColor === 'white' ? 'black' : 'white';

    const whiteUserId = userColor === 'white' ? userId : null;
    const blackUserId = userColor === 'black' ? userId : null;

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
        status: 'active',
        startedAt: new Date(nowMs),
        finalFen: STARTING_FEN,
        pgn: '',
      },
    });

    let engineState = this.engine.createGame({
      gameId: game.id,
      whiteUserId,
      blackUserId,
      timeMs,
      incrementMs,
      nowMs,
    });

    // Activate engine state
    engineState = { ...engineState, status: 'active' };

    let lastComputerMove: string | null = null;

    if (computerColor === 'white') {
      const bestMove = await this.stockfish.getBestMove(STARTING_FEN, dto.level);
      engineState = this.engine.applyMove(engineState, { uci: bestMove }, nowMs);
      lastComputerMove = bestMove;
    }

    const serialized = this.engine.toSerializable(engineState);
    const currentFen = engineState.position.fen();

    await this.prisma.game.update({
      where: { id: game.id },
      data: {
        engineState: serialized as object,
        finalFen: currentFen,
        lastComputerMove,
      },
    });

    if (lastComputerMove) {
      const compMove = engineState.moves[engineState.moves.length - 1]!;
      await this.prisma.move.create({
        data: {
          gameId: game.id,
          moveNumber: Math.ceil(compMove.ply / 2),
          ply: compMove.ply,
          userId: null,
          isComputer: true,
          san: compMove.san,
          uci: compMove.uci,
          fenAfterMove: compMove.fenAfter,
          clockAfterMoveMs: compMove.clockAfterMs,
          moveTimeMs: compMove.moveTimeMs,
        },
      });
    }

    if (userId) {
      this.posthog.captureEvent(userId, 'computer_game_created', {
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
      currentFen,
      '',
      'active',
      computerColor,
      lastComputerMove,
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
    if (!game) throw new NotFoundException('Game not found');
    if (!game.isVsComputer) throw new BadRequestException('Not a computer game');
    if (game.status !== 'active') throw new BadRequestException('Game is not active');
    if (game.whiteUserId !== userId && game.blackUserId !== userId) {
      throw new ForbiddenException('Not your game');
    }

    const gameComputerColor = game.computerColor as 'white' | 'black';

    if (dto.move === 'resign') {
      const userIsWhite = game.whiteUserId === userId;
      const result = userIsWhite ? GameResult.BlackWins : GameResult.WhiteWins;
      const reason = GameTermination.Resignation;
      const nowMs = Date.now();

      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          status: 'completed',
          result: result as unknown as PrismaGameResult,
          resultReason: reason as unknown as GameResultReason,
          endedAt: new Date(nowMs),
        },
      });

      if (userId) {
        this.posthog.captureEvent(userId, 'computer_game_completed', {
          game_id: gameId,
          result: 'loss',
          result_reason: 'resignation',
          computer_level: game.computerLevel ?? 1,
          category: game.category,
        });
      }

      return toStateDto(
        gameId,
        game.finalFen ?? STARTING_FEN,
        game.pgn,
        'completed',
        gameComputerColor,
        game.lastComputerMove ?? null,
        result,
        reason,
      );
    }

    if (!game.engineState) throw new BadRequestException('Engine state missing');

    const engineState = this.engine.fromSerializable(
      game.engineState as unknown as SerializableEngineState,
    );

    const userIsWhite = game.whiteUserId === userId;
    const isUserTurn = engineState.position.turn() === (userIsWhite ? 'w' : 'b');
    if (!isUserTurn) throw new BadRequestException('Not your turn');

    const nowMs = Date.now();

    // Apply user move
    let state = this.engine.applyMove(engineState, { uci: dto.move }, nowMs);
    const userEngineMove = state.moves[state.moves.length - 1]!;

    let lastComputerMove: string | null = null;
    let computerEngineMove: (typeof state.moves)[number] | null = null;

    // Check if game ended after user move
    const afterUserResult = this.engine.detectResult(state, nowMs);

    if (!afterUserResult) {
      // Computer's turn
      const currentFen = state.position.fen();
      const computerUci = await this.stockfish.getBestMove(
        currentFen,
        game.computerLevel ?? 1,
      );
      state = this.engine.applyMove(state, { uci: computerUci }, nowMs);
      lastComputerMove = computerUci;
      computerEngineMove = state.moves[state.moves.length - 1]!;
    }

    const finalResult = this.engine.detectResult(state, nowMs);
    const serialized = this.engine.toSerializable(state);
    const finalFen = state.position.fen();

    const pgn = this.engine.buildPgn(state.moves, {
      white: userIsWhite ? 'Player' : 'Computer',
      black: userIsWhite ? 'Computer' : 'Player',
      result: finalResult
        ? (finalResult.result === GameResult.WhiteWins
            ? '1-0'
            : finalResult.result === GameResult.BlackWins
              ? '0-1'
              : '1/2-1/2')
        : '*',
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.move.create({
        data: {
          gameId,
          moveNumber: Math.ceil(userEngineMove.ply / 2),
          ply: userEngineMove.ply,
          userId,
          isComputer: false,
          san: userEngineMove.san,
          uci: userEngineMove.uci,
          fenAfterMove: userEngineMove.fenAfter,
          clockAfterMoveMs: userEngineMove.clockAfterMs,
          moveTimeMs: userEngineMove.moveTimeMs,
        },
      });

      if (computerEngineMove) {
        await tx.move.create({
          data: {
            gameId,
            moveNumber: Math.ceil(computerEngineMove.ply / 2),
            ply: computerEngineMove.ply,
            userId: null,
            isComputer: true,
            san: computerEngineMove.san,
            uci: computerEngineMove.uci,
            fenAfterMove: computerEngineMove.fenAfter,
            clockAfterMoveMs: computerEngineMove.clockAfterMs,
            moveTimeMs: computerEngineMove.moveTimeMs,
          },
        });
      }

      await tx.game.update({
        where: { id: gameId },
        data: {
          engineState: serialized as object,
          finalFen,
          pgn,
          lastComputerMove,
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

    if (finalResult && userId) {
      const userIsWhite = game.whiteUserId === userId;
      let outcome: 'win' | 'loss' | 'draw';
      if (finalResult.result === GameResult.Draw) {
        outcome = 'draw';
      } else if (
        (userIsWhite && finalResult.result === GameResult.WhiteWins) ||
        (!userIsWhite && finalResult.result === GameResult.BlackWins)
      ) {
        outcome = 'win';
      } else {
        outcome = 'loss';
      }
      this.posthog.captureEvent(userId, 'computer_game_completed', {
        game_id: gameId,
        result: outcome,
        result_reason: finalResult.reason as string,
        computer_level: game.computerLevel ?? 1,
        category: game.category,
      });
    }

    return toStateDto(
      gameId,
      finalFen,
      pgn,
      finalResult ? 'completed' : 'active',
      gameComputerColor,
      lastComputerMove,
      finalResult ? (finalResult.result as string) : null,
      finalResult ? (finalResult.reason as string) : null,
    );
  }

  async getGame(gameId: string, userId: string | null): Promise<ComputerGameStateDto> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (!game.isVsComputer) throw new BadRequestException('Not a computer game');
    if (game.whiteUserId !== userId && game.blackUserId !== userId) {
      throw new ForbiddenException('Not your game');
    }

    return toStateDto(
      game.id,
      game.finalFen ?? STARTING_FEN,
      game.pgn,
      game.status,
      game.computerColor as 'white' | 'black',
      game.lastComputerMove ?? null,
      game.result ?? null,
      game.resultReason ?? null,
    );
  }
}

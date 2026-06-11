import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { GamesService } from '../../src/games/games.service';
import { PrismaService } from '../../src/database/prisma.service';
import { EngineService } from '../../src/chess/engine.service';
import { RealtimeService } from '../../src/realtime/realtime.service';
import { RatingsService } from '../../src/ratings/ratings.service';
import { PosthogService } from '../../src/analytics/posthog.service';
import { MatchmakingService } from '../../src/matchmaking/matchmaking.service';

const GAME_ID = 'game-1';
const REMATCH_ID = 'game-2';
const WHITE_ID = 'user-white';
const BLACK_ID = 'user-black';
const FEN_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_AFTER = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: GAME_ID,
    whiteUserId: WHITE_ID,
    blackUserId: BLACK_ID,
    whitePlayer: { id: WHITE_ID, username: 'whitey' },
    blackPlayer: { id: BLACK_ID, username: 'blacky' },
    isVsComputer: false,
    status: 'active',
    timeControlSeconds: 600,
    incrementSeconds: 0,
    category: 'rapid',
    isRated: true,
    engineState: makeSerialized(),
    finalFen: FEN_START,
    pgn: '',
    result: null,
    resultReason: null,
    rematchGameId: null,
    rematchOfferedBy: null,
    ...overrides,
  };
}

function makeSerialized(overrides: Record<string, unknown> = {}) {
  return {
    fen: FEN_START,
    moves: [] as unknown[],
    clock: { whiteMs: 600_000, blackMs: 600_000, lastTickAt: 1000, incrementMs: 0 },
    status: 'active',
    result: null,
    resultReason: null,
    pendingDrawOfferBy: null,
    ...overrides,
  };
}

function makeEngineState(moves: unknown[] = [], fen = FEN_START) {
  return {
    position: { turn: () => 'w', fen: () => fen },
    clock: { whiteMs: 600_000n, blackMs: 600_000n, lastTickAt: 1000n, incrementMs: 0n },
    moves,
    status: 'active',
    result: null,
    resultReason: null,
    pendingDrawOfferBy: null,
  };
}

const APPLIED_MOVE = {
  ply: 1,
  san: 'e4',
  uci: 'e2e4',
  fenAfter: FEN_AFTER,
  clockAfterMs: 599_000,
  moveTimeMs: 1_000,
};

const txMock = {
  move: { create: jest.fn() },
  game: {
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    create: jest.fn().mockResolvedValue({ id: REMATCH_ID }),
  },
};

const mockPrisma = {
  game: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  $transaction: jest.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
};

const mockEngine = {
  createGame: jest.fn(),
  fromSerializable: jest.fn(),
  toSerializable: jest.fn(),
  applyMove: jest.fn(),
  detectResult: jest.fn(),
  buildPgn: jest.fn().mockReturnValue('1. e4 *'),
};

const mockRealtime = {
  emitGameState: jest.fn(),
  emitGameOver: jest.fn(),
  emitGamePresence: jest.fn(),
};

const mockRatings = {
  processGameResult: jest.fn().mockResolvedValue(undefined),
};

const mockPosthog = {
  captureEvent: jest.fn(),
  captureException: jest.fn(),
  identify: jest.fn(),
};

const mockMatchmaking = {
  dequeue: jest.fn().mockResolvedValue(undefined),
};

describe('GamesService', () => {
  let service: GamesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EngineService, useValue: mockEngine },
        { provide: RealtimeService, useValue: mockRealtime },
        { provide: RatingsService, useValue: mockRatings },
        { provide: PosthogService, useValue: mockPosthog },
        { provide: MatchmakingService, useValue: mockMatchmaking },
      ],
    }).compile();
    service = module.get(GamesService);
  });

  describe('realtime emits', () => {
    it('pushes color-neutral state to the room after a persisted move', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame());
      mockEngine.fromSerializable.mockReturnValue(makeEngineState());
      mockEngine.applyMove.mockResolvedValue(makeEngineState([APPLIED_MOVE], FEN_AFTER));
      mockEngine.detectResult.mockResolvedValue(null);
      mockEngine.toSerializable.mockReturnValue(
        makeSerialized({ fen: FEN_AFTER, moves: [APPLIED_MOVE] }),
      );

      const dto = await service.submitMove(GAME_ID, WHITE_ID, 'e2e4');

      expect(dto.fen).toBe(FEN_AFTER);
      expect(txMock.move.create).toHaveBeenCalledTimes(1);
      expect(mockRealtime.emitGameState).toHaveBeenCalledTimes(1);
      const [roomGameId, payload] = mockRealtime.emitGameState.mock.calls[0];
      expect(roomGameId).toBe(GAME_ID);
      expect(payload).toMatchObject({
        gameId: GAME_ID,
        fen: FEN_AFTER,
        status: 'active',
        lastMove: 'e2e4',
        ply: 1,
      });
      expect(typeof payload.serverNow).toBe('number');
      // Color-neutral: one emit serves both players.
      expect(payload).not.toHaveProperty('yourColor');
      expect(payload).not.toHaveProperty('white');
      expect(mockRealtime.emitGameOver).not.toHaveBeenCalled();
      // Emit-after-persist: clients must never receive state the DB rolled back.
      expect(mockRealtime.emitGameState.mock.invocationCallOrder[0]).toBeGreaterThan(
        mockPrisma.$transaction.mock.invocationCallOrder[0],
      );
    });

    it('does not push state when the move transaction fails', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame());
      mockEngine.fromSerializable.mockReturnValue(makeEngineState());
      mockEngine.applyMove.mockResolvedValue(makeEngineState([APPLIED_MOVE], FEN_AFTER));
      mockEngine.detectResult.mockResolvedValue(null);
      mockEngine.toSerializable.mockReturnValue(
        makeSerialized({ fen: FEN_AFTER, moves: [APPLIED_MOVE] }),
      );
      // Simulate a commit failure: the callback runs, the transaction rejects.
      mockPrisma.$transaction.mockImplementationOnce(
        async (fn: (tx: typeof txMock) => Promise<unknown>) => {
          await fn(txMock);
          throw new Error('commit failed');
        },
      );

      await expect(service.submitMove(GAME_ID, WHITE_ID, 'e2e4')).rejects.toThrow(
        'commit failed',
      );
      expect(mockRealtime.emitGameState).not.toHaveBeenCalled();
    });

    it('emits game over alongside state when the move ends the game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame());
      mockEngine.fromSerializable.mockReturnValue(makeEngineState());
      mockEngine.applyMove.mockResolvedValue(makeEngineState([APPLIED_MOVE], FEN_AFTER));
      mockEngine.detectResult.mockResolvedValue({
        result: 'white_wins',
        reason: 'checkmate',
      });
      mockEngine.toSerializable.mockReturnValue(
        makeSerialized({ fen: FEN_AFTER, moves: [APPLIED_MOVE] }),
      );

      await service.submitMove(GAME_ID, WHITE_ID, 'e2e4');

      expect(mockRealtime.emitGameOver).toHaveBeenCalledWith(GAME_ID, {
        gameId: GAME_ID,
        result: 'white_wins',
        termination: 'checkmate',
      });
      expect(mockRatings.processGameResult).toHaveBeenCalledWith(GAME_ID);
    });

    it('rating processing failure does not break the game-over response', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame());
      mockRatings.processGameResult.mockRejectedValueOnce(new Error('db down'));

      const dto = await service.resign(GAME_ID, BLACK_ID);

      expect(dto.status).toBe('completed');
      expect(mockRatings.processGameResult).toHaveBeenCalledWith(GAME_ID);
    });

    it('flag fall persists timeout without a Move row and emits game over (bug-005)', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame());
      const engineState = makeEngineState();
      mockEngine.fromSerializable.mockReturnValue(engineState);
      // applyMove returns completed WITHOUT appending the attempted move.
      mockEngine.applyMove.mockResolvedValue({
        ...makeEngineState([], FEN_START),
        status: 'completed',
        result: 'black_wins',
        resultReason: 'timeout',
      });
      mockEngine.toSerializable.mockReturnValue(
        makeSerialized({ status: 'completed', result: 'black_wins', resultReason: 'timeout' }),
      );

      const dto = await service.submitMove(GAME_ID, WHITE_ID, 'e2e4');

      expect(dto.status).toBe('completed');
      expect(dto.result).toBe('black_wins');
      expect(txMock.move.create).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      // The timeout must actually be PERSISTED — bug-005's contract is that the
      // flagged game is written completed without a Move row, not just reported.
      // The write is guarded on status so racing completion paths can't double-finalize.
      expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: GAME_ID, status: 'active' },
          data: expect.objectContaining({
            status: 'completed',
            result: 'black_wins',
            resultReason: 'timeout',
          }),
        }),
      );
      expect(mockRealtime.emitGameState).toHaveBeenCalledTimes(1);
      expect(mockRealtime.emitGameOver).toHaveBeenCalledWith(GAME_ID, {
        gameId: GAME_ID,
        result: 'black_wins',
        termination: 'timeout',
      });
    });

    it('resign finalizes and emits state + game over', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame());

      const dto = await service.resign(GAME_ID, BLACK_ID);

      expect(dto.status).toBe('completed');
      expect(dto.result).toBe('white_wins');
      expect(mockRealtime.emitGameState).toHaveBeenCalledTimes(1);
      expect(mockRealtime.emitGameState.mock.calls[0][1]).toMatchObject({
        status: 'completed',
        result: 'white_wins',
        resultReason: 'resignation',
      });
      expect(mockRealtime.emitGameOver).toHaveBeenCalledWith(GAME_ID, {
        gameId: GAME_ID,
        result: 'white_wins',
        termination: 'resignation',
      });
    });

    it('getState finalizes idle flag fall and pushes it to the room', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame());
      mockEngine.fromSerializable.mockReturnValue(makeEngineState());
      mockEngine.detectResult.mockResolvedValue({
        result: 'black_wins',
        reason: 'timeout',
      });

      const dto = await service.getState(GAME_ID, WHITE_ID);

      expect(dto.status).toBe('completed');
      expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: GAME_ID, status: 'active' },
          data: expect.objectContaining({
            status: 'completed',
            result: 'black_wins',
            resultReason: 'timeout',
          }),
        }),
      );
      expect(mockRealtime.emitGameOver).toHaveBeenCalledWith(GAME_ID, {
        gameId: GAME_ID,
        result: 'black_wins',
        termination: 'timeout',
      });
    });

    it('getState without a result change emits nothing', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame());
      mockEngine.fromSerializable.mockReturnValue(makeEngineState());
      mockEngine.detectResult.mockResolvedValue(null);

      await service.getState(GAME_ID, WHITE_ID);

      expect(mockRealtime.emitGameState).not.toHaveBeenCalled();
      expect(mockRealtime.emitGameOver).not.toHaveBeenCalled();
    });

    it('getState serves the persisted truth when another path finalized first', async () => {
      // Flag-fall detection races a resign: the guarded write loses (count 0)
      // and getState must return the persisted completed game, not throw.
      mockPrisma.game.findUnique
        .mockResolvedValueOnce(makeGame())
        .mockResolvedValueOnce(
          makeGame({
            status: 'completed',
            result: 'white_wins',
            resultReason: 'resignation',
          }),
        );
      mockEngine.fromSerializable.mockReturnValue(makeEngineState());
      mockEngine.detectResult.mockResolvedValue({
        result: 'black_wins',
        reason: 'timeout',
      });
      mockPrisma.game.updateMany.mockResolvedValueOnce({ count: 0 });

      const dto = await service.getState(GAME_ID, WHITE_ID);

      expect(dto.status).toBe('completed');
      expect(dto.result).toBe('white_wins');
      expect(mockRealtime.emitGameOver).not.toHaveBeenCalled();
      expect(mockRatings.processGameResult).not.toHaveBeenCalled();
    });
  });

  describe('finalize PGN', () => {
    it('resign persists a PGN with the real result tag, not *', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame());
      mockEngine.buildPgn.mockReturnValueOnce('1. e4 1-0');

      const dto = await service.resign(GAME_ID, BLACK_ID);

      expect(mockEngine.buildPgn).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ result: '1-0' }),
      );
      expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ pgn: '1. e4 1-0' }),
        }),
      );
      expect(dto.pgn).toBe('1. e4 1-0');
      expect(mockRealtime.emitGameState.mock.calls[0][1].pgn).toBe('1. e4 1-0');
    });
  });

  describe('draw', () => {
    it('offer persists the pending offer via a status-guarded write and emits', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame());

      const dto = await service.draw(GAME_ID, WHITE_ID, 'offer');

      expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: GAME_ID, status: 'active' },
          data: {
            engineState: expect.objectContaining({ pendingDrawOfferBy: 'w' }),
          },
        }),
      );
      expect(dto.drawOfferedBy).toBe('white');
      expect(mockRealtime.emitGameState).toHaveBeenCalledTimes(1);
      expect(mockRealtime.emitGameState.mock.calls[0][1]).toMatchObject({
        drawOfferedBy: 'white',
        status: 'active',
      });
      // Persist before emit.
      expect(mockRealtime.emitGameState.mock.invocationCallOrder[0]).toBeGreaterThan(
        mockPrisma.game.updateMany.mock.invocationCallOrder[0],
      );
      expect(mockRealtime.emitGameOver).not.toHaveBeenCalled();
      expect(mockPosthog.captureEvent).toHaveBeenCalledWith(
        WHITE_ID,
        'pvp_draw_offered',
        expect.any(Object),
      );
    });

    it('rejects a second offer from the same player', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({ engineState: makeSerialized({ pendingDrawOfferBy: 'w' }) }),
      );

      await expect(service.draw(GAME_ID, WHITE_ID, 'offer')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects draw actions on a finished game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame({ status: 'completed' }));

      await expect(service.draw(GAME_ID, WHITE_ID, 'offer')).rejects.toThrow(
        'Game is not active',
      );
    });

    it('crossing offers complete the draw (both players want it)', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({ engineState: makeSerialized({ pendingDrawOfferBy: 'b' }) }),
      );

      const dto = await service.draw(GAME_ID, WHITE_ID, 'offer');

      expect(dto.result).toBe('draw');
      expect(dto.resultReason).toBe('draw_agreement');
      expect(mockRealtime.emitGameOver).toHaveBeenCalledWith(GAME_ID, {
        gameId: GAME_ID,
        result: 'draw',
        termination: 'draw_agreement',
      });
    });

    it('accept finalizes draw by agreement and settles ratings', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({ engineState: makeSerialized({ pendingDrawOfferBy: 'w' }) }),
      );

      const dto = await service.draw(GAME_ID, BLACK_ID, 'accept');

      expect(dto.status).toBe('completed');
      expect(dto.result).toBe('draw');
      expect(mockEngine.buildPgn).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ result: '1/2-1/2' }),
      );
      // The completed engine state must clear the offer.
      expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: GAME_ID, status: 'active' },
          data: expect.objectContaining({
            status: 'completed',
            engineState: expect.objectContaining({ pendingDrawOfferBy: null }),
          }),
        }),
      );
      expect(mockRealtime.emitGameOver).toHaveBeenCalledTimes(1);
      expect(mockRatings.processGameResult).toHaveBeenCalledWith(GAME_ID);
    });

    it('cannot accept your own offer or a missing offer', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({ engineState: makeSerialized({ pendingDrawOfferBy: 'w' }) }),
      );
      await expect(service.draw(GAME_ID, WHITE_ID, 'accept')).rejects.toThrow(
        BadRequestException,
      );

      mockPrisma.game.findUnique.mockResolvedValue(makeGame());
      await expect(service.draw(GAME_ID, BLACK_ID, 'accept')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accept racing a concurrent completion throws Conflict and emits nothing', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({ engineState: makeSerialized({ pendingDrawOfferBy: 'w' }) }),
      );
      mockPrisma.game.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.draw(GAME_ID, BLACK_ID, 'accept')).rejects.toThrow(
        ConflictException,
      );
      expect(mockRealtime.emitGameState).not.toHaveBeenCalled();
      expect(mockRealtime.emitGameOver).not.toHaveBeenCalled();
      expect(mockRatings.processGameResult).not.toHaveBeenCalled();
    });

    it('decline clears the offer; offerer cannot decline', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({ engineState: makeSerialized({ pendingDrawOfferBy: 'w' }) }),
      );

      const dto = await service.draw(GAME_ID, BLACK_ID, 'decline');

      expect(dto.drawOfferedBy).toBeNull();
      expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            engineState: expect.objectContaining({ pendingDrawOfferBy: null }),
          },
        }),
      );

      await expect(service.draw(GAME_ID, WHITE_ID, 'decline')).rejects.toThrow(
        BadRequestException,
      );
    });

    it("opponent's move implicitly declines the offer; offerer's own move keeps it", async () => {
      // Black offered, white moves → cleared.
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({ engineState: makeSerialized({ pendingDrawOfferBy: 'b' }) }),
      );
      mockEngine.fromSerializable.mockReturnValue(makeEngineState());
      mockEngine.applyMove.mockResolvedValue(makeEngineState([APPLIED_MOVE], FEN_AFTER));
      mockEngine.detectResult.mockResolvedValue(null);
      mockEngine.toSerializable.mockReturnValue(
        makeSerialized({ fen: FEN_AFTER, moves: [APPLIED_MOVE], pendingDrawOfferBy: 'b' }),
      );

      const dto = await service.submitMove(GAME_ID, WHITE_ID, 'e2e4');
      expect(dto.drawOfferedBy).toBeNull();
      expect(txMock.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            engineState: expect.objectContaining({ pendingDrawOfferBy: null }),
          }),
        }),
      );

      // White offered, white moves → offer stands.
      jest.clearAllMocks();
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({ engineState: makeSerialized({ pendingDrawOfferBy: 'w' }) }),
      );
      mockEngine.fromSerializable.mockReturnValue(makeEngineState());
      mockEngine.applyMove.mockResolvedValue(makeEngineState([APPLIED_MOVE], FEN_AFTER));
      mockEngine.detectResult.mockResolvedValue(null);
      mockEngine.toSerializable.mockReturnValue(
        makeSerialized({ fen: FEN_AFTER, moves: [APPLIED_MOVE], pendingDrawOfferBy: 'w' }),
      );

      const dto2 = await service.submitMove(GAME_ID, WHITE_ID, 'e2e4');
      expect(dto2.drawOfferedBy).toBe('white');
      expect(txMock.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            engineState: expect.objectContaining({ pendingDrawOfferBy: 'w' }),
          }),
        }),
      );
    });
  });

  describe('abort', () => {
    it('aborts before move two with no result, no game-over emit, no ratings', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({ engineState: makeSerialized({ moves: [APPLIED_MOVE] }) }),
      );

      const dto = await service.abort(GAME_ID, BLACK_ID);

      expect(dto.status).toBe('aborted');
      expect(dto.result).toBeNull();
      expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: GAME_ID, status: 'active' },
          data: expect.objectContaining({ status: 'aborted' }),
        }),
      );
      expect(mockRealtime.emitGameState).toHaveBeenCalledTimes(1);
      expect(mockRealtime.emitGameState.mock.calls[0][1]).toMatchObject({
        status: 'aborted',
      });
      expect(mockRealtime.emitGameOver).not.toHaveBeenCalled();
      expect(mockRatings.processGameResult).not.toHaveBeenCalled();
    });

    it('rejects abort once both sides have moved', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({
          engineState: makeSerialized({ moves: [APPLIED_MOVE, { ...APPLIED_MOVE, ply: 2 }] }),
        }),
      );

      await expect(service.abort(GAME_ID, WHITE_ID)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.game.updateMany).not.toHaveBeenCalled();
    });

    it('abort racing a completion throws Conflict', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame());
      mockPrisma.game.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.abort(GAME_ID, WHITE_ID)).rejects.toThrow(ConflictException);
      expect(mockRealtime.emitGameState).not.toHaveBeenCalled();
    });
  });

  describe('rematch', () => {
    it('rejects rematch actions while the game is in progress', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame());

      await expect(service.rematch(GAME_ID, WHITE_ID, 'offer')).rejects.toThrow(
        'Game is still in progress',
      );
    });

    it('offer creates a color-swapped linked game and emits the pending state', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(makeGame({ status: 'completed' }));

      const dto = await service.rematch(GAME_ID, WHITE_ID, 'offer');

      expect(txMock.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            whiteUserId: BLACK_ID,
            blackUserId: WHITE_ID,
            timeControlSeconds: 600,
            category: 'rapid',
            isRated: true,
            status: 'invite_pending',
          }),
        }),
      );
      // Link claim is guarded so two offers can't create two games.
      expect(txMock.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: GAME_ID, rematchGameId: null },
          data: { rematchGameId: REMATCH_ID, rematchOfferedBy: WHITE_ID },
        }),
      );
      expect(dto.rematch).toEqual({
        gameId: REMATCH_ID,
        offeredBy: 'white',
        status: 'pending',
      });
      expect(mockRealtime.emitGameState).toHaveBeenCalledTimes(1);
      expect(mockRealtime.emitGameState.mock.calls[0][1]).toMatchObject({
        rematch: { gameId: REMATCH_ID, status: 'pending' },
      });
    });

    it('a second offer from the same player conflicts', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({
          status: 'completed',
          rematchGameId: REMATCH_ID,
          rematchOfferedBy: WHITE_ID,
        }),
      );

      await expect(service.rematch(GAME_ID, WHITE_ID, 'offer')).rejects.toThrow(
        ConflictException,
      );
    });

    it("the other player's offer converts to an accept (both clicked = consent)", async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({
          status: 'completed',
          rematchGameId: REMATCH_ID,
          rematchOfferedBy: WHITE_ID,
        }),
      );

      const dto = await service.rematch(GAME_ID, BLACK_ID, 'offer');

      expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: REMATCH_ID, status: 'invite_pending' },
          data: expect.objectContaining({ status: 'active' }),
        }),
      );
      expect(dto.rematch).toMatchObject({ gameId: REMATCH_ID, status: 'accepted' });
    });

    it('accept dequeues both players from matchmaking', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({
          status: 'completed',
          rematchGameId: REMATCH_ID,
          rematchOfferedBy: WHITE_ID,
        }),
      );

      await service.rematch(GAME_ID, BLACK_ID, 'accept');

      expect(mockMatchmaking.dequeue).toHaveBeenCalledWith(WHITE_ID, BLACK_ID);
    });

    it('accept activates the linked game; the offerer cannot accept', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({
          status: 'completed',
          rematchGameId: REMATCH_ID,
          rematchOfferedBy: WHITE_ID,
        }),
      );

      const dto = await service.rematch(GAME_ID, BLACK_ID, 'accept');
      expect(dto.rematch).toMatchObject({ status: 'accepted' });
      expect(mockRealtime.emitGameState.mock.calls[0][1]).toMatchObject({
        rematch: { status: 'accepted' },
      });

      await expect(service.rematch(GAME_ID, WHITE_ID, 'accept')).rejects.toThrow(
        'You offered this rematch',
      );
    });

    it('double accept is idempotent when the game is already active', async () => {
      mockPrisma.game.findUnique
        .mockResolvedValueOnce(
          makeGame({
            status: 'completed',
            rematchGameId: REMATCH_ID,
            rematchOfferedBy: WHITE_ID,
          }),
        )
        .mockResolvedValueOnce({ status: 'active' });
      mockPrisma.game.updateMany.mockResolvedValueOnce({ count: 0 });

      const dto = await service.rematch(GAME_ID, BLACK_ID, 'accept');
      expect(dto.rematch).toMatchObject({ status: 'accepted' });
    });

    it('decline aborts the pending game and clears the link for re-offers', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        makeGame({
          status: 'completed',
          rematchGameId: REMATCH_ID,
          rematchOfferedBy: WHITE_ID,
        }),
      );

      const dto = await service.rematch(GAME_ID, BLACK_ID, 'decline');

      expect(txMock.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: REMATCH_ID, status: 'invite_pending' },
          data: expect.objectContaining({ status: 'aborted' }),
        }),
      );
      expect(txMock.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: GAME_ID },
          data: { rematchGameId: null, rematchOfferedBy: null },
        }),
      );
      expect(dto.rematch).toBeNull();
      expect(mockRealtime.emitGameState.mock.calls[0][1]).toMatchObject({ rematch: null });
    });

    it('getState surfaces a pending rematch to a reloading player', async () => {
      mockPrisma.game.findUnique
        .mockResolvedValueOnce(
          makeGame({
            status: 'completed',
            result: 'white_wins',
            resultReason: 'resignation',
            rematchGameId: REMATCH_ID,
            rematchOfferedBy: BLACK_ID,
          }),
        )
        .mockResolvedValueOnce({ status: 'invite_pending' });

      const dto = await service.getState(GAME_ID, WHITE_ID);

      expect(dto.rematch).toEqual({
        gameId: REMATCH_ID,
        offeredBy: 'black',
        status: 'pending',
      });
    });
  });
});

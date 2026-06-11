import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from '../../src/games/games.service';
import { PrismaService } from '../../src/database/prisma.service';
import { EngineService } from '../../src/chess/engine.service';
import { RealtimeService } from '../../src/realtime/realtime.service';
import { RatingsService } from '../../src/ratings/ratings.service';

const GAME_ID = 'game-1';
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
    engineState: makeSerialized(),
    finalFen: FEN_START,
    pgn: '',
    result: null,
    resultReason: null,
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
  game: { update: jest.fn() },
};

const mockPrisma = {
  game: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock)),
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

describe('GamesService realtime emits', () => {
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
      ],
    }).compile();
    service = module.get(GamesService);
  });

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
});

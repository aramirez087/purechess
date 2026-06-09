import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ComputerGamesService } from '../../src/computer-games/computer-games.service';
import { PrismaService } from '../../src/database/prisma.service';
import { EngineService } from '../../src/chess/engine.service';
import { PosthogService } from '../../src/analytics/posthog.service';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const GAME_ID = 'game-1';
const USER_ID = 'user-1';

// Engine state where it is White (the human) to move, no moves played yet.
const emptyEngineState = {
  gameId: GAME_ID,
  whiteUserId: USER_ID,
  blackUserId: null,
  fen: STARTING_FEN,
  fenHistory: [STARTING_FEN],
  moves: [] as Array<{ ply: number; san: string; uci: string }>,
  pendingDrawOfferBy: null,
  clock: { whiteMs: 300000, blackMs: 300000, lastTickAt: 0, incrementMs: 0 },
  status: 'active' as const,
  result: null,
  resultReason: null,
  position: { fen: () => STARTING_FEN, turn: () => 'w' },
};

const mockPrisma = {
  game: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  move: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockEngine = {
  createGame: jest.fn(),
  applyMove: jest.fn(),
  detectResult: jest.fn(),
  toSerializable: jest.fn(),
  fromSerializable: jest.fn(),
  buildPgn: jest.fn(),
};

const mockPosthog = {
  captureEvent: jest.fn(),
  captureException: jest.fn(),
};

describe('ComputerGamesService', () => {
  let service: ComputerGamesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComputerGamesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EngineService, useValue: mockEngine },
        { provide: PosthogService, useValue: mockPosthog },
      ],
    }).compile();

    service = module.get<ComputerGamesService>(ComputerGamesService);
  });

  describe('createGame', () => {
    // color: 'white' → userColor='white', computerColor='black'
    const dto = { color: 'white' as const, level: 3, timeControlSeconds: 300, incrementSeconds: 0 };

    beforeEach(() => {
      mockPrisma.game.create.mockResolvedValue({
        id: GAME_ID,
        whiteUserId: USER_ID,
        blackUserId: null,
        computerColor: 'black',
        computerLevel: 3,
      });
      mockEngine.createGame.mockReturnValue({ ...emptyEngineState });
      mockEngine.toSerializable.mockReturnValue({});
      mockPrisma.game.update.mockResolvedValue({});
    });

    it('creates game with user playing white, computer playing black', async () => {
      const result = await service.createGame(USER_ID, dto);

      expect(mockPrisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            whiteUserId: USER_ID,
            blackUserId: null,
            computerColor: 'black',
            isVsComputer: true,
          }),
        }),
      );
      expect(result.computerColor).toBe('black');
      expect(result.status).toBe('active');
    });

    it('records the user on the opposite color when computer plays white', async () => {
      mockPrisma.game.create.mockResolvedValue({
        id: GAME_ID,
        whiteUserId: null,
        blackUserId: USER_ID,
        computerColor: 'white',
        computerLevel: 3,
      });

      const result = await service.createGame(USER_ID, { ...dto, color: 'black' });

      expect(mockPrisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            whiteUserId: null,
            blackUserId: USER_ID,
            computerColor: 'white',
          }),
        }),
      );
      expect(result.computerColor).toBe('white');
    });

    it('does not run an engine on creation (moves are computed client-side)', async () => {
      await service.createGame(USER_ID, dto);

      // The server no longer plays the computer's move on creation.
      expect(mockEngine.applyMove).not.toHaveBeenCalled();
    });
  });

  describe('submitMove — legal move', () => {
    const baseGame = {
      id: GAME_ID,
      whiteUserId: USER_ID,
      blackUserId: null,
      isVsComputer: true,
      status: 'active',
      computerColor: 'black',
      computerLevel: 3,
      finalFen: STARTING_FEN,
      pgn: '',
      lastComputerMove: null,
      category: 'rapid',
      engineState: {},
    };

    let txMock: { move: { create: jest.Mock }; game: { update: jest.Mock } };

    beforeEach(() => {
      mockPrisma.game.findUnique.mockResolvedValue(baseGame);
      mockEngine.fromSerializable.mockReturnValue({ ...emptyEngineState });
      // applyMove appends one move (human, White).
      mockEngine.applyMove.mockResolvedValue({
        ...emptyEngineState,
        moves: [{ ply: 1, san: 'e4', uci: 'e2e4', fenAfter: AFTER_E4_FEN, clockAfterMs: 300000, moveTimeMs: 0 }],
        position: { fen: () => AFTER_E4_FEN, turn: () => 'b' },
      });
      mockEngine.detectResult.mockResolvedValue(null);
      mockEngine.toSerializable.mockReturnValue({});
      mockEngine.buildPgn.mockReturnValue('1. e4 *');

      txMock = { move: { create: jest.fn() }, game: { update: jest.fn() } };
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
    });

    it('persists the move and returns active game state', async () => {
      const result = await service.submitMove(GAME_ID, USER_ID, { move: 'e2e4' });

      expect(mockEngine.applyMove).toHaveBeenCalledWith(
        expect.anything(),
        { uci: 'e2e4' },
        expect.any(Number),
      );
      expect(txMock.move.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ply: 1, san: 'e4', uci: 'e2e4', isComputer: false, userId: USER_ID }),
        }),
      );
      expect(result.status).toBe('active');
      expect(result.fen).toBe(AFTER_E4_FEN);
    });

    it('throws BadRequestException on an illegal move', async () => {
      const { InvalidMoveError } = await import('../../src/chess/engine.service');
      mockEngine.applyMove.mockImplementation(() => {
        throw new InvalidMoveError('illegal move');
      });

      await expect(service.submitMove(GAME_ID, USER_ID, { move: 'e2e5' })).rejects.toThrow(BadRequestException);
      expect(txMock.move.create).not.toHaveBeenCalled();
    });
  });

  describe('submitMove — clock flagged (no move appended)', () => {
    const baseGame = {
      id: GAME_ID,
      whiteUserId: USER_ID,
      blackUserId: null,
      isVsComputer: true,
      status: 'active',
      computerColor: 'black',
      computerLevel: 3,
      finalFen: STARTING_FEN,
      pgn: '1. Nf3 *',
      lastComputerMove: 'g1f3',
      category: 'rapid',
      engineState: {},
    };

    beforeEach(() => {
      mockPrisma.game.findUnique.mockResolvedValue(baseGame);
      mockPrisma.game.update.mockResolvedValue({});
      // Engine state already has one move; the human is to move (White).
      const flaggedState = {
        ...emptyEngineState,
        moves: [{ ply: 1, san: 'Nf3', uci: 'g1f3' }],
      };
      mockEngine.fromSerializable.mockReturnValue(flaggedState);
      // applyMove detects the flag: returns completed WITHOUT appending a move.
      mockEngine.applyMove.mockResolvedValue({
        ...flaggedState,
        status: 'completed',
        result: 'black_wins',
        resultReason: 'timeout',
      });
      mockEngine.toSerializable.mockReturnValue({});
    });

    it('completes the game on timeout and does NOT create a duplicate move row', async () => {
      const result = await service.submitMove(GAME_ID, USER_ID, { move: 'e2e4' });

      expect(mockPrisma.move.create).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
            result: 'black_wins',
            resultReason: 'timeout',
          }),
        }),
      );
      expect(result.status).toBe('completed');
      expect(result.result).toBe('black_wins');
      expect(result.resultReason).toBe('timeout');
    });
  });

  describe('submitMove — resign path', () => {
    const baseGame = {
      id: GAME_ID,
      whiteUserId: USER_ID,
      blackUserId: null,
      isVsComputer: true,
      status: 'active',
      computerColor: 'black',
      computerLevel: 3,
      finalFen: STARTING_FEN,
      pgn: '',
      lastComputerMove: null,
      category: 'rapid',
      engineState: {},
    };

    beforeEach(() => {
      mockPrisma.game.findUnique.mockResolvedValue(baseGame);
      mockPrisma.game.update.mockResolvedValue({});
    });

    it('marks game completed with computer as winner on resign', async () => {
      const result = await service.submitMove(GAME_ID, USER_ID, { move: 'resign' });

      expect(mockPrisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
            result: 'black_wins',
            resultReason: 'resignation',
          }),
        }),
      );
      expect(result.status).toBe('completed');
      expect(result.result).toBe('black_wins');
      expect(result.resultReason).toBe('resignation');
    });

    it('does not apply an engine move on resign', async () => {
      await service.submitMove(GAME_ID, USER_ID, { move: 'resign' });

      expect(mockEngine.applyMove).not.toHaveBeenCalled();
    });
  });

  describe('submitMove — error paths', () => {
    it('throws NotFoundException when game not found', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      await expect(service.submitMove(GAME_ID, USER_ID, { move: 'e2e4' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when not a computer game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({ id: GAME_ID, isVsComputer: false, status: 'active', whiteUserId: USER_ID });

      await expect(service.submitMove(GAME_ID, USER_ID, { move: 'e2e4' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when game not active', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({ id: GAME_ID, isVsComputer: true, status: 'completed', whiteUserId: USER_ID });

      await expect(service.submitMove(GAME_ID, USER_ID, { move: 'e2e4' })).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when user is not a player', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: GAME_ID,
        isVsComputer: true,
        status: 'active',
        whiteUserId: 'other-user',
        blackUserId: 'another-user',
      });

      await expect(service.submitMove(GAME_ID, USER_ID, { move: 'e2e4' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getGame', () => {
    it('returns game state for owner', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: GAME_ID,
        isVsComputer: true,
        whiteUserId: USER_ID,
        blackUserId: null,
        computerColor: 'black',
        finalFen: STARTING_FEN,
        pgn: '',
        status: 'active',
        result: null,
        resultReason: null,
        lastComputerMove: null,
      });

      const result = await service.getGame(GAME_ID, USER_ID);

      expect(result.gameId).toBe(GAME_ID);
      expect(result.computerColor).toBe('black');
      expect(result.status).toBe('active');
    });

    it('throws NotFoundException when game does not exist', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      await expect(service.getGame(GAME_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when not a computer game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({ id: GAME_ID, isVsComputer: false, whiteUserId: USER_ID });

      await expect(service.getGame(GAME_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when user is not the owner', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        id: GAME_ID,
        isVsComputer: true,
        whiteUserId: 'other-user',
        blackUserId: null,
      });

      await expect(service.getGame(GAME_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('submitMove — clock-aware (timed game)', () => {
    const timedGame = {
      id: GAME_ID,
      whiteUserId: USER_ID,
      blackUserId: null,
      isVsComputer: true,
      status: 'active',
      computerColor: 'black',
      computerLevel: 3,
      timeControlSeconds: 300,
      finalFen: STARTING_FEN,
      pgn: '',
      lastComputerMove: null,
      category: 'rapid',
      engineState: {},
    };

    let txMock: { move: { create: jest.Mock }; game: { update: jest.Mock } };

    beforeEach(() => {
      mockPrisma.game.findUnique.mockResolvedValue(timedGame);
      // lastTickAt deliberately non-zero so we can assert it is NOT reset for a timed game.
      mockEngine.fromSerializable.mockReturnValue({
        ...emptyEngineState,
        clock: { whiteMs: 300000n, blackMs: 300000n, lastTickAt: 1000n, incrementMs: 2000n },
      });
      mockEngine.applyMove.mockResolvedValue({
        ...emptyEngineState,
        moves: [{ ply: 1, san: 'e4', uci: 'e2e4', fenAfter: AFTER_E4_FEN, clockAfterMs: 297000, moveTimeMs: 5000, by: 'w' }],
        position: { fen: () => AFTER_E4_FEN, turn: () => 'b' },
      });
      mockEngine.detectResult.mockResolvedValue(null);
      // Serialized state carries the ticked clock (white spent 3s + 2s increment net).
      mockEngine.toSerializable.mockReturnValue({
        clock: { whiteMs: 297000, blackMs: 300000, lastTickAt: 99999, incrementMs: 2000 },
        moves: [{ ply: 1, san: 'e4', uci: 'e2e4', fenAfter: AFTER_E4_FEN, clockAfterMs: 297000, moveTimeMs: 5000, by: 'w' }],
        pendingDrawOfferBy: null,
      });
      mockEngine.buildPgn.mockReturnValue('1. e4 *');

      txMock = { move: { create: jest.fn() }, game: { update: jest.fn() } };
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
    });

    it('does NOT reset lastTickAt for a timed game (lets applyMove tick real elapsed)', async () => {
      await service.submitMove(GAME_ID, USER_ID, { move: 'e2e4' });

      const passedState = mockEngine.applyMove.mock.calls[0]![0] as { clock: { lastTickAt: bigint } };
      expect(passedState.clock.lastTickAt).toBe(1000n);
    });

    it('populates the serialized clock on the returned state DTO', async () => {
      const result = await service.submitMove(GAME_ID, USER_ID, { move: 'e2e4' });

      expect(result.clock).toEqual({
        whiteMs: 297000,
        blackMs: 300000,
        lastTickAt: 99999,
        incrementMs: 2000,
      });
    });

    it('flags on time without a 500 or duplicate move row (bug-005 guard, timed path)', async () => {
      mockEngine.applyMove.mockResolvedValue({
        ...emptyEngineState,
        status: 'completed',
        result: 'black_wins',
        resultReason: 'timeout',
      });
      mockEngine.toSerializable.mockReturnValue({ clock: { whiteMs: 0, blackMs: 300000, lastTickAt: 1, incrementMs: 2000 }, moves: [], pendingDrawOfferBy: null });
      mockPrisma.game.update.mockResolvedValue({});

      const result = await service.submitMove(GAME_ID, USER_ID, { move: 'e2e4' });

      expect(mockPrisma.move.create).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(result.status).toBe('completed');
      expect(result.resultReason).toBe('timeout');
    });
  });

  describe('submitMove — untimed game still never flags', () => {
    const untimedGame = {
      id: GAME_ID,
      whiteUserId: USER_ID,
      blackUserId: null,
      isVsComputer: true,
      status: 'active',
      computerColor: 'black',
      computerLevel: 3,
      timeControlSeconds: 0,
      finalFen: STARTING_FEN,
      pgn: '',
      lastComputerMove: null,
      category: 'rapid',
      engineState: {},
    };

    beforeEach(() => {
      mockPrisma.game.findUnique.mockResolvedValue(untimedGame);
      mockEngine.fromSerializable.mockReturnValue({
        ...emptyEngineState,
        clock: { whiteMs: 0n, blackMs: 0n, lastTickAt: 1000n, incrementMs: 0n },
      });
      mockEngine.applyMove.mockResolvedValue({
        ...emptyEngineState,
        moves: [{ ply: 1, san: 'e4', uci: 'e2e4', fenAfter: AFTER_E4_FEN, clockAfterMs: 0, moveTimeMs: 0, by: 'w' }],
        position: { fen: () => AFTER_E4_FEN, turn: () => 'b' },
      });
      mockEngine.detectResult.mockResolvedValue(null);
      mockEngine.toSerializable.mockReturnValue({ clock: { whiteMs: 0, blackMs: 0, lastTickAt: 0, incrementMs: 0 }, moves: [], pendingDrawOfferBy: null });
      mockEngine.buildPgn.mockReturnValue('1. e4 *');
      const txMock = { move: { create: jest.fn() }, game: { update: jest.fn() } };
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
    });

    it('resets lastTickAt to now so isTimeout cannot fire', async () => {
      await service.submitMove(GAME_ID, USER_ID, { move: 'e2e4' });

      const passedState = mockEngine.applyMove.mock.calls[0]![0] as { clock: { lastTickAt: bigint } };
      expect(passedState.clock.lastTickAt).not.toBe(1000n);
    });
  });

  describe('createGameFromFen', () => {
    // No en-passant target: chess.js round-trips this FEN unchanged.
    const VALID_FEN = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const dto = { fen: VALID_FEN, color: 'white' as const, level: 4 as const, timeControlSeconds: 300, incrementSeconds: 2 };

    beforeEach(() => {
      mockPrisma.game.create.mockResolvedValue({ id: GAME_ID });
      mockPrisma.game.update.mockResolvedValue({});
    });

    it('creates an active game at the supplied position', async () => {
      const result = await service.createGameFromFen(USER_ID, dto);

      expect(mockPrisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isVsComputer: true,
            isRated: false,
            computerColor: 'black',
            startingFen: VALID_FEN,
            finalFen: VALID_FEN,
          }),
        }),
      );
      expect(result.status).toBe('active');
      expect(result.fen).toBe(VALID_FEN);
      expect(result.clock).toEqual({ whiteMs: 300000, blackMs: 300000, lastTickAt: expect.any(Number), incrementMs: 2000 });
      expect(result.abortable).toBe(true);
    });

    it('rejects an invalid FEN with BadRequestException', async () => {
      await expect(
        service.createGameFromFen(USER_ID, { ...dto, fen: 'not a real fen' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.game.create).not.toHaveBeenCalled();
    });
  });
});

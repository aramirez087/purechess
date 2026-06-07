import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ComputerGamesService } from '../../src/computer-games/computer-games.service';
import { PrismaService } from '../../src/database/prisma.service';
import { EngineService } from '../../src/chess/engine.service';
import { StockfishService } from '../../src/computer-games/stockfish.service';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const GAME_ID = 'game-1';
const USER_ID = 'user-1';

const baseEngineState = {
  gameId: GAME_ID,
  whiteUserId: USER_ID,
  blackUserId: null,
  fen: STARTING_FEN,
  fenHistory: [STARTING_FEN],
  moves: [],
  pendingDrawOfferBy: null,
  clock: { whiteMs: 300000, blackMs: 300000, lastTickAt: 0, incrementMs: 0 },
  status: 'active' as const,
  result: null,
  resultReason: null,
  position: {
    fen: () => STARTING_FEN,
    turn: () => 'w',
  },
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

const mockStockfish = {
  getBestMove: jest.fn(),
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
        { provide: StockfishService, useValue: mockStockfish },
      ],
    }).compile();

    service = module.get<ComputerGamesService>(ComputerGamesService);
  });

  describe('createGame', () => {
    // color: 'white' → userColor='white', computerColor='black' → no stockfish on creation
    const dto = { color: 'white' as const, level: 3, timeControlSeconds: 300, incrementSeconds: 0 };

    beforeEach(() => {
      mockPrisma.game.create.mockResolvedValue({
        id: GAME_ID,
        whiteUserId: USER_ID,
        blackUserId: null,
        computerColor: 'black',
        computerLevel: 3,
      });
      mockEngine.createGame.mockReturnValue({ ...baseEngineState });
      mockEngine.applyMove.mockReturnValue({
        ...baseEngineState,
        moves: [{ ply: 1, san: 'e4', uci: 'e2e4', fenAfter: STARTING_FEN, clockAfterMs: 300000, moveTimeMs: 0 }],
        position: { fen: () => STARTING_FEN, turn: () => 'b' },
      });
      mockEngine.toSerializable.mockReturnValue({});
      mockPrisma.game.update.mockResolvedValue({});
      mockPrisma.move.create.mockResolvedValue({});
      mockStockfish.getBestMove.mockResolvedValue('e2e4');
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

    it('calls stockfish when computer plays white', async () => {
      // color: 'black' → userColor='black', computerColor='white' → stockfish called
      mockPrisma.game.create.mockResolvedValue({
        id: GAME_ID,
        whiteUserId: null,
        blackUserId: USER_ID,
        computerColor: 'white',
        computerLevel: 3,
      });

      await service.createGame(USER_ID, { ...dto, color: 'black' });

      expect(mockStockfish.getBestMove).toHaveBeenCalledWith(STARTING_FEN, 3);
    });

    it('does not call stockfish when computer plays black', async () => {
      // color: 'white' → computerColor='black' → no stockfish
      await service.createGame(USER_ID, dto);

      expect(mockStockfish.getBestMove).not.toHaveBeenCalled();
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

    it('skips stockfish call on resign', async () => {
      await service.submitMove(GAME_ID, USER_ID, { move: 'resign' });

      expect(mockStockfish.getBestMove).not.toHaveBeenCalled();
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
});

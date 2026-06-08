import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ComputerGameActionsService } from '../../src/computer-games/computer-game-actions.service';
import { ComputerGamesService } from '../../src/computer-games/computer-games.service';
import { PrismaService } from '../../src/database/prisma.service';
import { EngineService } from '../../src/chess/engine.service';
import { PosthogService } from '../../src/analytics/posthog.service';

const GAME_ID = 'game-1';
const USER_ID = 'user-1';
const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Human plays White, computer plays Black. Four plies played.
function serializedFixture(overrides: Record<string, unknown> = {}) {
  return {
    gameId: GAME_ID,
    whiteUserId: USER_ID,
    blackUserId: null,
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    fenHistory: ['fen0', 'fen1', 'fen2', 'fen3', 'fen4'],
    moves: [
      { ply: 1, san: 'e4', uci: 'e2e4', fenAfter: 'fenA', clockAfterMs: 298000, moveTimeMs: 2000, by: 'w' },
      { ply: 2, san: 'e5', uci: 'e7e5', fenAfter: 'fenB', clockAfterMs: 297000, moveTimeMs: 3000, by: 'b' },
      { ply: 3, san: 'Nf3', uci: 'g1f3', fenAfter: 'fenC', clockAfterMs: 296000, moveTimeMs: 2000, by: 'w' },
      { ply: 4, san: 'Nc6', uci: 'b8c6', fenAfter: 'fenD', clockAfterMs: 295000, moveTimeMs: 2000, by: 'b' },
    ],
    pendingDrawOfferBy: null,
    clock: { whiteMs: 296000, blackMs: 295000, lastTickAt: 5000, incrementMs: 0 },
    status: 'active',
    result: null,
    resultReason: null,
    ...overrides,
  };
}

function gameFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: GAME_ID,
    whiteUserId: USER_ID,
    blackUserId: null,
    isVsComputer: true,
    status: 'active',
    computerColor: 'black',
    computerLevel: 4,
    timeControlSeconds: 300,
    incrementSeconds: 0,
    finalFen: STARTING_FEN,
    startingFen: STARTING_FEN,
    pgn: '1. e4 e5 2. Nf3 Nc6 *',
    lastComputerMove: 'b8c6',
    category: 'rapid',
    result: null,
    resultReason: null,
    engineState: serializedFixture(),
    ...overrides,
  };
}

const mockPrisma = {
  game: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  move: { deleteMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockEngine = {
  fromSerializable: jest.fn(),
  detectResult: jest.fn(),
  buildPgn: jest.fn(),
};

const mockPosthog = { captureEvent: jest.fn(), captureException: jest.fn() };

const mockComputerGames = { createGame: jest.fn() };

describe('ComputerGameActionsService', () => {
  let service: ComputerGameActionsService;
  let txMock: { move: { deleteMany: jest.Mock }; game: { update: jest.Mock } };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComputerGameActionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EngineService, useValue: mockEngine },
        { provide: PosthogService, useValue: mockPosthog },
        { provide: ComputerGamesService, useValue: mockComputerGames },
      ],
    }).compile();

    service = module.get<ComputerGameActionsService>(ComputerGameActionsService);

    mockEngine.buildPgn.mockReturnValue('pgn');
    mockPrisma.game.update.mockResolvedValue({});
    txMock = { move: { deleteMany: jest.fn() }, game: { update: jest.fn() } };
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
  });

  // ---- Common guards ----

  describe('guards', () => {
    it('NotFound when game absent', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);
      await expect(service.takeback(GAME_ID, USER_ID, 1)).rejects.toThrow(NotFoundException);
    });

    it('BadRequest when not a computer game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture({ isVsComputer: false }));
      await expect(service.abort(GAME_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('Forbidden when user is not a player', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture({ whiteUserId: 'other', blackUserId: 'another' }));
      await expect(service.draw(GAME_ID, USER_ID, 'offer')).rejects.toThrow(ForbiddenException);
    });
  });

  // ---- Takeback ----

  describe('takeback', () => {
    it('plies=1 deletes the trailing ply and reactivates', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());

      const result = await service.takeback(GAME_ID, USER_ID, 1);

      expect(txMock.move.deleteMany).toHaveBeenCalledWith({ where: { gameId: GAME_ID, ply: { gt: 3 } } });
      expect(result.status).toBe('active');
      expect(result.fen).toBe('fenC');
      // last computer (black) move among surviving 3 plies is ply 2 (e7e5)
      expect(result.lastComputerMove).toBe('e7e5');
    });

    it('plies=2 removes the human move and the bot reply', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());

      const result = await service.takeback(GAME_ID, USER_ID, 2);

      expect(txMock.move.deleteMany).toHaveBeenCalledWith({ where: { gameId: GAME_ID, ply: { gt: 2 } } });
      expect(result.fen).toBe('fenB');
    });

    it('rejects takeback with no moves', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture({ engineState: serializedFixture({ moves: [] }) }));
      await expect(service.takeback(GAME_ID, USER_ID, 1)).rejects.toThrow(BadRequestException);
    });

    it('reopens a completed game to active', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        gameFixture({ status: 'completed', result: 'white_wins', resultReason: 'checkmate' }),
      );

      const result = await service.takeback(GAME_ID, USER_ID, 1);

      expect(txMock.game.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'active', result: null, resultReason: null, endedAt: null }) }),
      );
      expect(result.status).toBe('active');
    });
  });

  // ---- Rewind ----

  describe('rewind', () => {
    it('truncates to a mid-ply and deletes rows beyond it', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());

      const result = await service.rewind(GAME_ID, USER_ID, 1);

      expect(txMock.move.deleteMany).toHaveBeenCalledWith({ where: { gameId: GAME_ID, ply: { gt: 1 } } });
      expect(result.fen).toBe('fenA');
    });

    it('rewind to ply 0 returns to the starting position', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());

      const result = await service.rewind(GAME_ID, USER_ID, 0);

      expect(txMock.move.deleteMany).toHaveBeenCalledWith({ where: { gameId: GAME_ID, ply: { gt: 0 } } });
      expect(result.fen).toBe(STARTING_FEN);
      expect(result.lastComputerMove).toBeNull();
    });

    it('rejects a negative ply', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());
      await expect(service.rewind(GAME_ID, USER_ID, -1)).rejects.toThrow(BadRequestException);
    });

    it('rejects a ply at or beyond the move count', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());
      await expect(service.rewind(GAME_ID, USER_ID, 4)).rejects.toThrow(BadRequestException);
      await expect(service.rewind(GAME_ID, USER_ID, 99)).rejects.toThrow(BadRequestException);
    });
  });

  // ---- Abort ----

  describe('abort', () => {
    it('aborts a game with no human moves', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        gameFixture({ engineState: serializedFixture({ moves: [] }) }),
      );

      const result = await service.abort(GAME_ID, USER_ID);

      expect(mockPrisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'aborted' }) }),
      );
      expect(result.status).toBe('aborted');
      expect(result.abortable).toBe(false);
    });

    it('allows abort when only the computer (White) has moved', async () => {
      // Computer plays White: one computer move, zero human moves -> still abortable.
      const oneComputerMove = serializedFixture({
        moves: [{ ply: 1, san: 'e4', uci: 'e2e4', fenAfter: 'fenA', clockAfterMs: 298000, moveTimeMs: 0, by: 'w' }],
      });
      mockPrisma.game.findUnique.mockResolvedValue(
        gameFixture({ computerColor: 'white', engineState: oneComputerMove }),
      );

      const result = await service.abort(GAME_ID, USER_ID);
      expect(result.status).toBe('aborted');
    });

    it('rejects abort after a human move', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());
      await expect(service.abort(GAME_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('rejects abort on a non-active game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture({ status: 'completed', engineState: serializedFixture({ moves: [] }) }));
      await expect(service.abort(GAME_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ---- Draw ----

  describe('draw', () => {
    it('offer records the human side as the offerer', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());

      const result = await service.draw(GAME_ID, USER_ID, 'offer');

      expect(mockPrisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ engineState: expect.objectContaining({ pendingDrawOfferBy: 'w' }) }) }),
      );
      expect(result.drawOffered).toBe(true);
      expect(result.drawOfferedBy).toBe('white');
    });

    it('accept without a pending offer is rejected', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());
      await expect(service.draw(GAME_ID, USER_ID, 'accept')).rejects.toThrow(BadRequestException);
    });

    it('accept with a pending offer completes as draw by agreement', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        gameFixture({ engineState: serializedFixture({ pendingDrawOfferBy: 'w' }) }),
      );

      const result = await service.draw(GAME_ID, USER_ID, 'accept');

      expect(mockPrisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'completed', result: 'draw', resultReason: 'draw_agreement' }) }),
      );
      expect(result.status).toBe('completed');
      expect(result.result).toBe('draw');
      expect(result.resultReason).toBe('draw_agreement');
    });

    it('decline clears the pending offer', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        gameFixture({ engineState: serializedFixture({ pendingDrawOfferBy: 'w' }) }),
      );

      const result = await service.draw(GAME_ID, USER_ID, 'decline');

      expect(mockPrisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ engineState: expect.objectContaining({ pendingDrawOfferBy: null }) }) }),
      );
      expect(result.drawOffered).toBe(false);
    });

    it('claim succeeds when the engine detects a draw', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());
      mockEngine.fromSerializable.mockReturnValue({});
      mockEngine.detectResult.mockReturnValue({ result: 'draw', reason: 'threefold_repetition' });

      const result = await service.draw(GAME_ID, USER_ID, 'claim');

      expect(mockPrisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'completed', result: 'draw', resultReason: 'threefold_repetition' }) }),
      );
      expect(result.resultReason).toBe('threefold_repetition');
    });

    it('claim is rejected when no draw is detectable', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());
      mockEngine.fromSerializable.mockReturnValue({});
      mockEngine.detectResult.mockReturnValue(null);

      await expect(service.draw(GAME_ID, USER_ID, 'claim')).rejects.toThrow(BadRequestException);
    });

    it('claim is rejected when the detected result is not a draw', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());
      mockEngine.fromSerializable.mockReturnValue({});
      mockEngine.detectResult.mockReturnValue({ result: 'white_wins', reason: 'checkmate' });

      await expect(service.draw(GAME_ID, USER_ID, 'claim')).rejects.toThrow(BadRequestException);
    });

    it('rejects draw actions on a non-active game', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture({ status: 'completed' }));
      await expect(service.draw(GAME_ID, USER_ID, 'offer')).rejects.toThrow(BadRequestException);
    });
  });

  // ---- Rematch ----

  describe('rematch', () => {
    it('creates a new game with the same settings and human color', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());
      mockComputerGames.createGame.mockResolvedValue({ gameId: 'game-2', status: 'active' });

      const result = await service.rematch(GAME_ID, USER_ID);

      expect(mockComputerGames.createGame).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ level: 4, color: 'white', timeControlSeconds: 300, incrementSeconds: 0 }),
      );
      expect(result.gameId).toBe('game-2');
    });

    it('swapColors flips the human color', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameFixture());
      mockComputerGames.createGame.mockResolvedValue({ gameId: 'game-3' });

      await service.rematch(GAME_ID, USER_ID, true);

      expect(mockComputerGames.createGame).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ color: 'black' }),
      );
    });
  });
});

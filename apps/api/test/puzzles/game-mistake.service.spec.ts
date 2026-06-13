import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { MistakeCandidateDto } from '@purechess/shared';
import {
  GameMistakeService,
  MISTAKE_CP_THRESHOLD,
} from '../../src/puzzles/game-mistake.service';
import { PrismaService } from '../../src/database/prisma.service';

// Legal positions from a real opening (generated via chess.js so every FEN is
// guaranteed legal — bug-522: synthetic test FENs must be legal). The game is
// 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6. White is `u-white`, Black is `u-black`.
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MOVES = [
  { ply: 1, uci: 'e2e4', fenAfterMove: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' },
  { ply: 2, uci: 'e7e5', fenAfterMove: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
  { ply: 3, uci: 'g1f3', fenAfterMove: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' },
  { ply: 4, uci: 'b8c6', fenAfterMove: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' },
  { ply: 5, uci: 'f1b5', fenAfterMove: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3' },
  { ply: 6, uci: 'a7a6', fenAfterMove: 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4' },
];

// Position BEFORE ply 3 (White's 2nd move) = FEN after ply 2.
const FEN_BEFORE_PLY3 = MOVES[1].fenAfterMove;
// Position BEFORE ply 4 (Black's 2nd move) = FEN after ply 3.
const FEN_BEFORE_PLY4 = MOVES[2].fenAfterMove;

const mockPrisma = {
  game: { findUnique: jest.fn() },
  gameMistake: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
};

function gameRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'g1',
    whiteUserId: 'u-white',
    blackUserId: 'u-black',
    startingFen: null, // standard start
    moves: MOVES.map((m) => ({ ply: m.ply, uci: m.uci, fenAfterMove: m.fenAfterMove })),
    ...over,
  };
}

/** A valid White-side mistake claim at ply 3 (matches the persisted record). */
function whiteMistakeAtPly3(over: Partial<MistakeCandidateDto> = {}): MistakeCandidateDto {
  return {
    ply: 3,
    fen: FEN_BEFORE_PLY3,
    playedUci: 'g1f3',
    bestUci: 'f1c4',
    bestLineUci: ['f1c4', 'g8f6'],
    cpLoss: 300,
    themeGuess: ['fork'],
    ...over,
  };
}

describe('GameMistakeService', () => {
  let service: GameMistakeService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameMistakeService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<GameMistakeService>(GameMistakeService);
  });

  describe('saveMistakes — ownership + server-side verification', () => {
    it('rejects a game that does not belong to the user', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameRow());
      await expect(
        service.saveMistakes('stranger', 'g1', [whiteMistakeAtPly3()]),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.gameMistake.upsert).not.toHaveBeenCalled();
    });

    it('throws NotFound when the game does not exist', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);
      await expect(
        service.saveMistakes('u-white', 'nope', [whiteMistakeAtPly3()]),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('persists a valid own-side over-threshold mistake with the SERVER-derived FEN', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameRow());
      mockPrisma.gameMistake.upsert.mockResolvedValue({});

      // Client claims a FEN with bogus halfmove clocks — server must still match
      // (it compares placement/turn/castling/ep only) and STORE its own FEN.
      const claim = whiteMistakeAtPly3({ fen: FEN_BEFORE_PLY3.replace('0 2', '9 9') });
      const saved = await service.saveMistakes('u-white', 'g1', [claim]);

      expect(saved).toBe(1);
      expect(mockPrisma.gameMistake.upsert).toHaveBeenCalledTimes(1);
      const arg = mockPrisma.gameMistake.upsert.mock.calls[0][0];
      expect(arg.where).toEqual({
        gameId_ply_userId: { gameId: 'g1', ply: 3, userId: 'u-white' },
      });
      // The stored FEN is the one the SERVER re-derived, not the client's claim.
      expect(arg.create.fen).toBe(FEN_BEFORE_PLY3);
      expect(arg.create.playedUci).toBe('g1f3');
      expect(arg.create.bestLineUci).toEqual(['f1c4', 'g8f6']);
      expect(arg.create.cpLoss).toBe(300);
      expect(arg.create.themeGuess).toEqual(['fork']);
    });

    it('REJECTS a spoofed FEN that disagrees with the re-derived position', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameRow());
      // A real but WRONG position (start FEN) for ply 3 — must be skipped.
      const spoof = whiteMistakeAtPly3({ fen: START_FEN });
      const saved = await service.saveMistakes('u-white', 'g1', [spoof]);
      expect(saved).toBe(0);
      expect(mockPrisma.gameMistake.upsert).not.toHaveBeenCalled();
    });

    it('REJECTS a spoofed playedUci that disagrees with the recorded move', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameRow());
      const spoof = whiteMistakeAtPly3({ playedUci: 'd2d4' }); // not what was played
      const saved = await service.saveMistakes('u-white', 'g1', [spoof]);
      expect(saved).toBe(0);
      expect(mockPrisma.gameMistake.upsert).not.toHaveBeenCalled();
    });

    it("skips the opponent's moves — only the user's OWN side is persisted", async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameRow());
      // Ply 4 is Black's move; the user is White, so it is not their mistake.
      const blackMove: MistakeCandidateDto = {
        ply: 4,
        fen: FEN_BEFORE_PLY4,
        playedUci: 'b8c6',
        bestUci: 'g8f6',
        bestLineUci: ['g8f6'],
        cpLoss: 400,
      };
      const saved = await service.saveMistakes('u-white', 'g1', [blackMove]);
      expect(saved).toBe(0);
      expect(mockPrisma.gameMistake.upsert).not.toHaveBeenCalled();
    });

    it('persists the same ply for the side that actually owns it', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameRow());
      mockPrisma.gameMistake.upsert.mockResolvedValue({});
      // Black owns ply 4; as u-black it must persist.
      const blackMove: MistakeCandidateDto = {
        ply: 4,
        fen: FEN_BEFORE_PLY4,
        playedUci: 'b8c6',
        bestUci: 'g8f6',
        bestLineUci: ['g8f6'],
        cpLoss: 400,
      };
      const saved = await service.saveMistakes('u-black', 'g1', [blackMove]);
      expect(saved).toBe(1);
      expect(mockPrisma.gameMistake.upsert.mock.calls[0][0].where.gameId_ply_userId.userId).toBe(
        'u-black',
      );
    });

    it('skips moves below the cpLoss threshold', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameRow());
      const small = whiteMistakeAtPly3({ cpLoss: MISTAKE_CP_THRESHOLD - 1 });
      const saved = await service.saveMistakes('u-white', 'g1', [small]);
      expect(saved).toBe(0);
      expect(mockPrisma.gameMistake.upsert).not.toHaveBeenCalled();
    });

    it('keeps exactly at the threshold', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameRow());
      mockPrisma.gameMistake.upsert.mockResolvedValue({});
      const atFloor = whiteMistakeAtPly3({ cpLoss: MISTAKE_CP_THRESHOLD });
      const saved = await service.saveMistakes('u-white', 'g1', [atFloor]);
      expect(saved).toBe(1);
    });

    it('skips a ply that is not in the game record (bogus claim)', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(gameRow());
      const ghost = whiteMistakeAtPly3({ ply: 99, fen: FEN_BEFORE_PLY3 });
      const saved = await service.saveMistakes('u-white', 'g1', [ghost]);
      expect(saved).toBe(0);
      expect(mockPrisma.gameMistake.upsert).not.toHaveBeenCalled();
    });

    it('honours a custom startingFen for ply-1 verification', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(
        gameRow({
          startingFen: START_FEN,
          // Only ply 1 matters here; a single recorded e4 move.
          moves: [{ ply: 1, uci: 'e2e4', fenAfterMove: MOVES[0].fenAfterMove }],
        }),
      );
      mockPrisma.gameMistake.upsert.mockResolvedValue({});
      const ply1: MistakeCandidateDto = {
        ply: 1,
        fen: START_FEN,
        playedUci: 'e2e4',
        bestUci: 'd2d4',
        bestLineUci: ['d2d4'],
        cpLoss: 200,
      };
      const saved = await service.saveMistakes('u-white', 'g1', [ply1]);
      expect(saved).toBe(1);
      expect(mockPrisma.gameMistake.upsert.mock.calls[0][0].create.fen).toBe(START_FEN);
    });
  });

  describe('listMistakes', () => {
    it('passes unreviewedOnly through to the where clause', async () => {
      mockPrisma.gameMistake.findMany.mockResolvedValue([]);
      await service.listMistakes('u-white', { unreviewedOnly: true });
      const arg = mockPrisma.gameMistake.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ userId: 'u-white', reviewed: false });
      expect(arg.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('does not filter by reviewed when unreviewedOnly is absent', async () => {
      mockPrisma.gameMistake.findMany.mockResolvedValue([]);
      await service.listMistakes('u-white');
      expect(mockPrisma.gameMistake.findMany.mock.calls[0][0].where).toEqual({ userId: 'u-white' });
    });

    it('maps rows to DTOs (createdAt ISO, themeGuess passthrough)', async () => {
      const createdAt = new Date('2026-06-01T00:00:00.000Z');
      mockPrisma.gameMistake.findMany.mockResolvedValue([
        {
          id: 'm1',
          gameId: 'g1',
          ply: 3,
          fen: FEN_BEFORE_PLY3,
          playedUci: 'g1f3',
          bestUci: 'f1c4',
          bestLineUci: ['f1c4'],
          cpLoss: 300,
          themeGuess: ['fork'],
          reviewed: false,
          createdAt,
        },
      ]);
      const dtos = await service.listMistakes('u-white');
      expect(dtos[0]).toEqual({
        id: 'm1',
        gameId: 'g1',
        ply: 3,
        fen: FEN_BEFORE_PLY3,
        playedUci: 'g1f3',
        bestUci: 'f1c4',
        bestLineUci: ['f1c4'],
        cpLoss: 300,
        themeGuess: ['fork'],
        reviewed: false,
        createdAt: '2026-06-01T00:00:00.000Z',
      });
    });
  });

  describe('getDueMistakes', () => {
    it('reads the unreviewed backlog oldest-first, capped by limit', async () => {
      mockPrisma.gameMistake.findMany.mockResolvedValue([]);
      await service.getDueMistakes('u-white', 5);
      const arg = mockPrisma.gameMistake.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ userId: 'u-white', reviewed: false });
      expect(arg.orderBy).toEqual({ createdAt: 'asc' });
      expect(arg.take).toBe(5);
    });
  });

  describe('markReviewed', () => {
    it('flips reviewed=true scoped to the owner and returns the next unreviewed', async () => {
      mockPrisma.gameMistake.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.gameMistake.findFirst.mockResolvedValue({
        id: 'm2',
        gameId: 'g1',
        ply: 5,
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        playedUci: 'f1b5',
        bestUci: 'f1c4',
        bestLineUci: ['f1c4'],
        cpLoss: 200,
        themeGuess: [],
        reviewed: false,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      });

      const next = await service.markReviewed('u-white', 'm1');

      const updateArg = mockPrisma.gameMistake.updateMany.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: 'm1', userId: 'u-white' });
      expect(updateArg.data).toEqual({ reviewed: true });
      expect(next?.id).toBe('m2');
    });

    it('returns null when nothing is left in the backlog', async () => {
      mockPrisma.gameMistake.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.gameMistake.findFirst.mockResolvedValue(null);
      const next = await service.markReviewed('u-white', 'm1');
      expect(next).toBeNull();
    });

    it('throws NotFound when the mistake is not the user’s (count 0)', async () => {
      mockPrisma.gameMistake.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.markReviewed('u-white', 'mX')).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.gameMistake.findFirst).not.toHaveBeenCalled();
    });
  });
});

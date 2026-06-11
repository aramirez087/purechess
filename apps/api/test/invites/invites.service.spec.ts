import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  GoneException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InvitesService } from '../../src/invites/invites.service';
import { PrismaService } from '../../src/database/prisma.service';
import { InviteGateway } from '../../src/invites/invite-gateway';
import { PosthogService } from '../../src/analytics/posthog.service';
import { MatchmakingService } from '../../src/matchmaking/matchmaking.service';

const CREATOR_ID = 'user-creator';
const ACCEPTOR_ID = 'user-acceptor';
const GAME_ID = 'game-001';
const TOKEN = 'abc123token';
const APP_URL = 'http://localhost:3000';

const NOW = new Date();
const EXPIRED = new Date(NOW.getTime() - 25 * 60 * 60 * 1000);

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: GAME_ID,
    whiteUserId: CREATOR_ID,
    blackUserId: null,
    timeControlSeconds: 600,
    incrementSeconds: 0,
    category: 'rapid',
    isRated: false,
    status: 'invite_pending',
    inviteToken: TOKEN,
    inviteColorChoice: null,
    createdAt: NOW,
    ...overrides,
  };
}

const mockPrisma = {
  game: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockGateway = {
  emitInviteCreated: jest.fn(),
  emitInviteAccepted: jest.fn(),
};

const mockPosthog = { captureEvent: jest.fn(), captureException: jest.fn(), identify: jest.fn() };
const mockMatchmaking = { dequeue: jest.fn().mockResolvedValue(undefined) };

describe('InvitesService', () => {
  let service: InvitesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InviteGateway, useValue: mockGateway },
        { provide: PosthogService, useValue: mockPosthog },
        { provide: MatchmakingService, useValue: mockMatchmaking },
      ],
    }).compile();

    service = module.get<InvitesService>(InvitesService);
  });

  describe('createInvite', () => {
    it('creates game, returns token of correct length, emits invite:created', async () => {
      const game = makeGame();
      mockPrisma.game.create.mockResolvedValue(game);

      const dto = { timeControlSeconds: 600, incrementSeconds: 0, category: 'rapid' as const };
      const result = await service.createInvite(CREATOR_ID, dto, 'white', APP_URL);

      expect(mockPrisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            whiteUserId: CREATOR_ID,
            blackUserId: null,
            status: 'invite_pending',
            isRated: false,
            inviteColorChoice: 'white',
          }),
        }),
      );
      expect(result.inviteToken).toHaveLength(22);
      expect(result.inviteUrl).toContain('/invite/');
      expect(mockGateway.emitInviteCreated).toHaveBeenCalledWith(
        CREATOR_ID,
        expect.objectContaining({ gameId: GAME_ID }),
      );
    });

    it('sets blackUserId to creator when color=black', async () => {
      const game = makeGame({ whiteUserId: null, blackUserId: CREATOR_ID });
      mockPrisma.game.create.mockResolvedValue(game);

      const dto = { timeControlSeconds: 60, incrementSeconds: 0, category: 'bullet' as const };
      await service.createInvite(CREATOR_ID, dto, 'black', APP_URL);

      expect(mockPrisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            whiteUserId: null,
            blackUserId: CREATOR_ID,
            inviteColorChoice: 'black',
          }),
        }),
      );
    });

    it('stores inviteColorChoice=random and provisionally parks creator as white', async () => {
      const game = makeGame({ inviteColorChoice: 'random' });
      mockPrisma.game.create.mockResolvedValue(game);

      const dto = { timeControlSeconds: 300, incrementSeconds: 0, category: 'blitz' as const };
      await service.createInvite(CREATOR_ID, dto, 'random', APP_URL);

      expect(mockPrisma.game.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            whiteUserId: CREATOR_ID,
            blackUserId: null,
            inviteColorChoice: 'random',
          }),
        }),
      );
    });
  });

  describe('getInviteByToken', () => {
    it('returns invite details without email', async () => {
      const game = makeGame();
      (game as Record<string, unknown>)['whitePlayer'] = { id: CREATOR_ID, username: 'alice', avatarUrl: null };
      (game as Record<string, unknown>)['blackPlayer'] = null;
      mockPrisma.game.findUnique.mockResolvedValue(game);

      const result = await service.getInviteByToken(TOKEN);

      expect(result.gameId).toBe(GAME_ID);
      expect(result.creator).not.toHaveProperty('email');
    });

    it('returns colorChoice=random when the creator picked random', async () => {
      const game = makeGame({ inviteColorChoice: 'random' });
      (game as Record<string, unknown>)['whitePlayer'] = { id: CREATOR_ID, username: 'alice', avatarUrl: null };
      (game as Record<string, unknown>)['blackPlayer'] = null;
      mockPrisma.game.findUnique.mockResolvedValue(game);

      const result = await service.getInviteByToken(TOKEN);

      expect(result.colorChoice).toBe('random');
      // creatorColor stays the provisional slot for compat
      expect(result.creatorColor).toBe('white');
    });

    it('legacy NULL rows preview as random when the creator sits in the white slot', async () => {
      // Mirrors acceptInvite's legacy heuristic: white-slot creator + empty
      // black slot is randomized at accept, so the preview must not promise
      // the acceptor a concrete color.
      const game = makeGame(); // inviteColorChoice: null, creator in white slot
      (game as Record<string, unknown>)['whitePlayer'] = { id: CREATOR_ID, username: 'alice', avatarUrl: null };
      (game as Record<string, unknown>)['blackPlayer'] = null;
      mockPrisma.game.findUnique.mockResolvedValue(game);

      const result = await service.getInviteByToken(TOKEN);

      expect(result.colorChoice).toBe('random');
      expect(result.creatorColor).toBe('white');
    });

    it('legacy NULL rows preview as black when the creator sits in the black slot', async () => {
      const game = makeGame({ whiteUserId: null, blackUserId: CREATOR_ID });
      (game as Record<string, unknown>)['whitePlayer'] = null;
      (game as Record<string, unknown>)['blackPlayer'] = { id: CREATOR_ID, username: 'alice', avatarUrl: null };
      mockPrisma.game.findUnique.mockResolvedValue(game);

      const result = await service.getInviteByToken(TOKEN);

      expect(result.colorChoice).toBe('black');
      expect(result.creatorColor).toBe('black');
    });

    it('throws GoneException for expired invite', async () => {
      const game = makeGame({ createdAt: EXPIRED });
      (game as Record<string, unknown>)['whitePlayer'] = { id: CREATOR_ID, username: 'alice', avatarUrl: null };
      (game as Record<string, unknown>)['blackPlayer'] = null;
      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.game.update.mockResolvedValue({ ...game, status: 'aborted' });

      await expect(service.getInviteByToken(TOKEN)).rejects.toThrow(GoneException);
    });

    it('throws NotFoundException for unknown token', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);
      await expect(service.getInviteByToken('no-such-token')).rejects.toThrow(NotFoundException);
    });
  });

  describe('acceptInvite', () => {
    it('flips status to active and emits invite:accepted', async () => {
      const game = makeGame();
      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.game.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.acceptInvite(TOKEN, ACCEPTOR_ID);

      expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: GAME_ID, status: 'invite_pending' },
          data: expect.objectContaining({ status: 'active' }),
        }),
      );
      expect(mockGateway.emitInviteAccepted).toHaveBeenCalledWith(
        CREATOR_ID,
        ACCEPTOR_ID,
        expect.objectContaining({ gameId: GAME_ID }),
      );
      expect(result.gameId).toBe(GAME_ID);
    });

    it('dequeues both players from matchmaking on activation', async () => {
      const game = makeGame();
      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.game.updateMany.mockResolvedValue({ count: 1 });

      await service.acceptInvite(TOKEN, ACCEPTOR_ID);

      expect(mockMatchmaking.dequeue).toHaveBeenCalledWith(CREATOR_ID, ACCEPTOR_ID);
    });

    it('does not dequeue when the accept loses the race', async () => {
      const game = makeGame();
      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.game.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.acceptInvite(TOKEN, ACCEPTOR_ID)).rejects.toThrow(ConflictException);
      expect(mockMatchmaking.dequeue).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when creator tries to accept', async () => {
      const game = makeGame();
      mockPrisma.game.findUnique.mockResolvedValue(game);

      await expect(service.acceptInvite(TOKEN, CREATOR_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException on race (updateMany count=0)', async () => {
      const game = makeGame();
      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.game.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.acceptInvite(TOKEN, ACCEPTOR_ID)).rejects.toThrow(ConflictException);
    });

    it('throws GoneException for expired invite', async () => {
      const game = makeGame({ createdAt: EXPIRED });
      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.game.update.mockResolvedValue({ ...game, status: 'aborted' });

      await expect(service.acceptInvite(TOKEN, ACCEPTOR_ID)).rejects.toThrow(GoneException);
    });

    describe('color assignment', () => {
      let randomSpy: jest.SpyInstance;

      beforeEach(() => {
        randomSpy = jest.spyOn(Math, 'random');
        mockPrisma.game.updateMany.mockResolvedValue({ count: 1 });
      });

      afterEach(() => {
        randomSpy.mockRestore();
      });

      it('colorChoice=random gives acceptor white when Math.random < 0.5', async () => {
        mockPrisma.game.findUnique.mockResolvedValue(makeGame({ inviteColorChoice: 'random' }));
        randomSpy.mockReturnValue(0.25);

        await service.acceptInvite(TOKEN, ACCEPTOR_ID);

        expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              whiteUserId: ACCEPTOR_ID,
              blackUserId: CREATOR_ID,
            }),
          }),
        );
      });

      it('colorChoice=random gives acceptor black when Math.random >= 0.5', async () => {
        mockPrisma.game.findUnique.mockResolvedValue(makeGame({ inviteColorChoice: 'random' }));
        randomSpy.mockReturnValue(0.75);

        await service.acceptInvite(TOKEN, ACCEPTOR_ID);

        expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              whiteUserId: CREATOR_ID,
              blackUserId: ACCEPTOR_ID,
            }),
          }),
        );
      });

      it('colorChoice=white keeps the creator white even when Math.random < 0.5', async () => {
        mockPrisma.game.findUnique.mockResolvedValue(makeGame({ inviteColorChoice: 'white' }));
        randomSpy.mockReturnValue(0.25);

        await service.acceptInvite(TOKEN, ACCEPTOR_ID);

        expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              whiteUserId: CREATOR_ID,
              blackUserId: ACCEPTOR_ID,
            }),
          }),
        );
      });

      it('legacy NULL column still randomizes via the null-slot heuristic', async () => {
        // creator in white slot, black slot empty, no stored choice → random (today's behavior)
        mockPrisma.game.findUnique.mockResolvedValue(makeGame());
        randomSpy.mockReturnValue(0.25);

        await service.acceptInvite(TOKEN, ACCEPTOR_ID);

        expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              whiteUserId: ACCEPTOR_ID,
              blackUserId: CREATOR_ID,
            }),
          }),
        );
      });

      it('legacy NULL column keeps the creator white when Math.random >= 0.5', async () => {
        mockPrisma.game.findUnique.mockResolvedValue(makeGame());
        randomSpy.mockReturnValue(0.75);

        await service.acceptInvite(TOKEN, ACCEPTOR_ID);

        expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              whiteUserId: CREATOR_ID,
              blackUserId: ACCEPTOR_ID,
            }),
          }),
        );
      });

      it('colorChoice=black puts the acceptor on white without consulting Math.random', async () => {
        mockPrisma.game.findUnique.mockResolvedValue(
          makeGame({ whiteUserId: null, blackUserId: CREATOR_ID, inviteColorChoice: 'black' }),
        );

        await service.acceptInvite(TOKEN, ACCEPTOR_ID);

        expect(randomSpy).not.toHaveBeenCalled();
        expect(mockPrisma.game.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              whiteUserId: ACCEPTOR_ID,
              blackUserId: CREATOR_ID,
            }),
          }),
        );
      });

      it('idempotency guard intact: count=0 still throws ConflictException for random invites', async () => {
        mockPrisma.game.findUnique.mockResolvedValue(makeGame({ inviteColorChoice: 'random' }));
        randomSpy.mockReturnValue(0.25);
        mockPrisma.game.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.acceptInvite(TOKEN, ACCEPTOR_ID)).rejects.toThrow(ConflictException);
      });
    });
  });

  describe('cancelInvite', () => {
    it('aborts the game for creator', async () => {
      const game = makeGame();
      mockPrisma.game.findUnique.mockResolvedValue(game);
      mockPrisma.game.update.mockResolvedValue({ ...game, status: 'aborted' });

      const result = await service.cancelInvite(TOKEN, CREATOR_ID);

      expect(mockPrisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'aborted' } }),
      );
      expect(result.success).toBe(true);
    });

    it('throws ForbiddenException for non-creator', async () => {
      const game = makeGame();
      mockPrisma.game.findUnique.mockResolvedValue(game);

      await expect(service.cancelInvite(TOKEN, ACCEPTOR_ID)).rejects.toThrow(ForbiddenException);
    });
  });
});

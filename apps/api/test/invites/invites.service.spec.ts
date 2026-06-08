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

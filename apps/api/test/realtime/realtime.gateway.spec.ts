import { Test, TestingModule } from '@nestjs/testing';
import { WsEvent } from '@purechess/shared';
import { RealtimeGateway } from '../../src/realtime/realtime.gateway';
import { RealtimeService, gameRoom } from '../../src/realtime/realtime.service';
import { SessionsService } from '../../src/auth/sessions.service';
import { PrismaService } from '../../src/database/prisma.service';

const USER_ID = 'user-1';
const OTHER_ID = 'user-2';
const GAME_ID = 'game-1';

function makeSocket(cookie?: string) {
  return {
    handshake: { headers: { cookie } },
    data: {} as Record<string, unknown>,
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
  };
}

const mockSessions = { lookupSession: jest.fn() };
const mockPrisma = { game: { findUnique: jest.fn() } };

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let realtime: RealtimeService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        RealtimeService,
        { provide: SessionsService, useValue: mockSessions },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    gateway = module.get(RealtimeGateway);
    realtime = module.get(RealtimeService);
  });

  describe('handshake auth middleware', () => {
    // Auth must complete during the handshake (server.use), not in
    // handleConnection — an async lookup there races the client's first
    // game:join message.
    type Middleware = (socket: unknown, next: (err?: Error) => void) => Promise<void>;

    function captureMiddleware(): Middleware {
      let middleware: Middleware | undefined;
      const server = {
        use: jest.fn((fn: Middleware) => {
          middleware = fn;
        }),
      };
      gateway.afterInit(server as never);
      expect(server.use).toHaveBeenCalledTimes(1);
      return middleware!;
    }

    it('rejects sockets without a session cookie', async () => {
      const middleware = captureMiddleware();
      const next = jest.fn();
      await middleware(makeSocket(undefined), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(mockSessions.lookupSession).not.toHaveBeenCalled();
    });

    it('rejects sockets with an invalid session', async () => {
      mockSessions.lookupSession.mockResolvedValue(null);
      const middleware = captureMiddleware();
      const next = jest.fn();
      await middleware(makeSocket('purechess_session=bad-token'), next);
      expect(mockSessions.lookupSession).toHaveBeenCalledWith('bad-token');
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('attaches userId from a valid session before the connection opens', async () => {
      mockSessions.lookupSession.mockResolvedValue({
        session: {},
        user: { id: USER_ID },
      });
      const middleware = captureMiddleware();
      const next = jest.fn();
      const socket = makeSocket('other=x; purechess_session=good-token');
      await middleware(socket, next);
      expect(next).toHaveBeenCalledWith();
      expect(socket.data['userId']).toBe(USER_ID);
    });
  });

  describe('onGameJoin', () => {
    function authedSocket() {
      const socket = makeSocket();
      socket.data['userId'] = USER_ID;
      socket.data['gameIds'] = new Set<string>();
      return socket;
    }

    it('denies join when the user is not a player', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        whiteUserId: OTHER_ID,
        blackUserId: 'user-3',
        isVsComputer: false,
      });
      const socket = authedSocket();
      await gateway.onGameJoin(socket as never, { gameId: GAME_ID });
      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        WsEvent.Error,
        expect.objectContaining({ code: 'game_join_denied' }),
      );
    });

    it('denies join for computer games', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        whiteUserId: USER_ID,
        blackUserId: null,
        isVsComputer: true,
      });
      const socket = authedSocket();
      await gateway.onGameJoin(socket as never, { gameId: GAME_ID });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('joins the game room and broadcasts presence for a player', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({
        whiteUserId: USER_ID,
        blackUserId: OTHER_ID,
        isVsComputer: false,
      });
      const presenceSpy = jest
        .spyOn(realtime, 'emitGamePresence')
        .mockImplementation(() => undefined);
      jest.spyOn(realtime, 'roomUserIds').mockResolvedValue([USER_ID]);

      const socket = authedSocket();
      await gateway.onGameJoin(socket as never, { gameId: GAME_ID });

      expect(socket.join).toHaveBeenCalledWith(gameRoom(GAME_ID));
      expect(
        (socket.data['gameIds'] as Set<string>).has(GAME_ID),
      ).toBe(true);
      expect(presenceSpy).toHaveBeenCalledWith(GAME_ID, {
        gameId: GAME_ID,
        userIds: [USER_ID],
      });
    });

    it('ignores joins from unauthenticated sockets', async () => {
      const socket = makeSocket();
      await gateway.onGameJoin(socket as never, { gameId: GAME_ID });
      expect(mockPrisma.game.findUnique).not.toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('re-broadcasts presence for every game the socket had joined', async () => {
      const presenceSpy = jest
        .spyOn(realtime, 'emitGamePresence')
        .mockImplementation(() => undefined);
      jest.spyOn(realtime, 'roomUserIds').mockResolvedValue([]);

      const socket = makeSocket();
      socket.data['userId'] = USER_ID;
      socket.data['gameIds'] = new Set([GAME_ID, 'game-2']);
      await gateway.handleDisconnect(socket as never);

      expect(presenceSpy).toHaveBeenCalledTimes(2);
      expect(presenceSpy).toHaveBeenCalledWith(GAME_ID, {
        gameId: GAME_ID,
        userIds: [],
      });
    });
  });
});

describe('RealtimeService', () => {
  it('is a no-op before a server is bound', () => {
    const service = new RealtimeService();
    expect(() =>
      service.emitGameState('g', {
        gameId: 'g',
        serverNow: 0,
        fen: '',
        pgn: '',
        status: 'active',
        lastMove: null,
        ply: 0,
        result: null,
        resultReason: null,
        clock: null,
      }),
    ).not.toThrow();
  });

  it('emits to the game room once bound', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const service = new RealtimeService();
    service.bindServer({ to } as never);

    service.emitGameOver('g1', {
      gameId: 'g1',
      result: 'white_wins' as never,
      termination: 'checkmate' as never,
    });

    expect(to).toHaveBeenCalledWith(gameRoom('g1'));
    expect(emit).toHaveBeenCalledWith(
      WsEvent.GameOver,
      expect.objectContaining({ gameId: 'g1' }),
    );
  });

  it('dedupes user ids across room sockets', async () => {
    const fetchSockets = jest
      .fn()
      .mockResolvedValue([
        { data: { userId: 'a' } },
        { data: { userId: 'a' } },
        { data: { userId: 'b' } },
        { data: {} },
      ]);
    const service = new RealtimeService();
    service.bindServer({ in: () => ({ fetchSockets }) } as never);

    await expect(service.roomUserIds('g')).resolves.toEqual(['a', 'b']);
  });
});

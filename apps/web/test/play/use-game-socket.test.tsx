import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { WsEvent } from '@purechess/shared';
import { useGameSocket } from '@/hooks/use-game-socket';

type Handler = (...args: unknown[]) => void;

const sockets: FakeSocket[] = [];

class FakeSocket {
  handlers = new Map<string, Handler>();
  emit = vi.fn();
  disconnect = vi.fn();

  on(event: string, handler: Handler) {
    this.handlers.set(event, handler);
    return this;
  }

  fire(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.(...args);
  }
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  }),
}));

function statePayload(overrides: Record<string, unknown> = {}) {
  return {
    gameId: 'g1',
    serverNow: Date.now() + 500,
    fen: 'fen-after',
    pgn: '1. e4',
    status: 'active',
    lastMove: 'e2e4',
    ply: 1,
    result: null,
    resultReason: null,
    clock: null,
    ...overrides,
  };
}

describe('useGameSocket', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.clearAllMocks();
  });

  it('does not connect when disabled', () => {
    renderHook(() => useGameSocket('g1', false, { onState: vi.fn(), onResync: vi.fn() }));
    expect(sockets).toHaveLength(0);
  });

  it('joins the game room on connect and reports connected', () => {
    const { result } = renderHook(() =>
      useGameSocket('g1', true, { onState: vi.fn(), onResync: vi.fn() }),
    );
    expect(result.current.connected).toBe(false);

    act(() => sockets[0]!.fire('connect'));

    expect(result.current.connected).toBe(true);
    expect(sockets[0]!.emit).toHaveBeenCalledWith(WsEvent.GameJoin, { gameId: 'g1' });
  });

  it('forwards state pushes for this game and derives the clock offset', () => {
    const onState = vi.fn();
    const { result } = renderHook(() =>
      useGameSocket('g1', true, { onState, onResync: vi.fn() }),
    );
    act(() => sockets[0]!.fire('connect'));

    const payload = statePayload();
    act(() => sockets[0]!.fire(WsEvent.GameState, payload));

    expect(onState).toHaveBeenCalledWith(payload);
    // serverNow was ~500ms ahead of the local clock.
    expect(result.current.clockOffsetMs).toBeGreaterThan(300);
    expect(result.current.clockOffsetMs).toBeLessThan(700);
  });

  it('ignores pushes for other games', () => {
    const onState = vi.fn();
    renderHook(() => useGameSocket('g1', true, { onState, onResync: vi.fn() }));
    act(() => sockets[0]!.fire('connect'));

    act(() => sockets[0]!.fire(WsEvent.GameState, statePayload({ gameId: 'other' })));

    expect(onState).not.toHaveBeenCalled();
  });

  it('tracks presence broadcasts and clears them on disconnect', () => {
    const { result } = renderHook(() =>
      useGameSocket('g1', true, { onState: vi.fn(), onResync: vi.fn() }),
    );
    act(() => sockets[0]!.fire('connect'));
    act(() =>
      sockets[0]!.fire(WsEvent.GamePresence, { gameId: 'g1', userIds: ['a', 'b'] }),
    );
    expect(result.current.presentUserIds).toEqual(['a', 'b']);

    act(() => sockets[0]!.fire('disconnect'));
    expect(result.current.connected).toBe(false);
    expect(result.current.presentUserIds).toBeNull();
  });

  it('requests a REST resync on reconnect, not on first connect', () => {
    const onResync = vi.fn();
    renderHook(() => useGameSocket('g1', true, { onState: vi.fn(), onResync }));

    act(() => sockets[0]!.fire('connect'));
    expect(onResync).not.toHaveBeenCalled();

    act(() => sockets[0]!.fire('disconnect'));
    act(() => sockets[0]!.fire('connect'));
    expect(onResync).toHaveBeenCalledTimes(1);
    // Rejoins the room on every connect.
    expect(sockets[0]!.emit).toHaveBeenCalledTimes(2);
  });

  it('disconnects the socket on unmount', () => {
    const { unmount } = renderHook(() =>
      useGameSocket('g1', true, { onState: vi.fn(), onResync: vi.fn() }),
    );
    unmount();
    expect(sockets[0]!.disconnect).toHaveBeenCalled();
  });
});

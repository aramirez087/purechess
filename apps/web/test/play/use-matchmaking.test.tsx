import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { WsEvent } from '@purechess/shared';
import { useMatchmaking } from '@/hooks/use-matchmaking';
import { getMatchmakingStatus, joinMatchmaking, leaveMatchmaking } from '@/lib/api/matchmaking';

type Handler = (...args: unknown[]) => void;

const sockets: FakeSocket[] = [];

class FakeSocket {
  handlers = new Map<string, Handler>();
  emit = vi.fn();
  disconnect = vi.fn();
  connect = vi.fn();
  connected = false;

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

vi.mock('@/lib/api/matchmaking', () => ({
  joinMatchmaking: vi.fn(),
  leaveMatchmaking: vi.fn().mockResolvedValue({ ok: true }),
  getMatchmakingStatus: vi.fn(),
}));

const PARAMS = {
  timeControlSeconds: 180,
  incrementSeconds: 0,
  category: 'blitz' as const,
  rated: true,
};

describe('useMatchmaking', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.clearAllMocks();
    vi.mocked(getMatchmakingStatus).mockResolvedValue({ status: 'queued', waitSeconds: 1 });
    vi.mocked(leaveMatchmaking).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('join → searching, instant match short-circuits to matched', async () => {
    vi.mocked(joinMatchmaking).mockResolvedValueOnce({ status: 'matched', gameId: 'g7' });
    const { result } = renderHook(() => useMatchmaking());

    await act(() => result.current.join(PARAMS));

    expect(result.current.state).toEqual({ phase: 'matched', gameId: 'g7' });
    expect(sockets).toHaveLength(0); // no queue socket needed
  });

  it('queued join opens the socket and a MatchFound push resolves the search', async () => {
    vi.mocked(joinMatchmaking).mockResolvedValueOnce({ status: 'queued' });
    const { result } = renderHook(() => useMatchmaking());

    await act(() => result.current.join(PARAMS));
    expect(result.current.state).toMatchObject({ phase: 'searching' });
    expect(sockets).toHaveLength(1);

    act(() => {
      sockets[0]!.fire(WsEvent.MatchFound, { gameId: 'g8', color: 'w', opponentId: 'opp' });
    });

    expect(result.current.state).toEqual({ phase: 'matched', gameId: 'g8' });
  });

  it('the status poll recovers a missed push', async () => {
    vi.mocked(joinMatchmaking).mockResolvedValueOnce({ status: 'queued' });
    const { result } = renderHook(() => useMatchmaking());
    await act(() => result.current.join(PARAMS));

    vi.mocked(getMatchmakingStatus).mockResolvedValue({ status: 'matched', gameId: 'g9' });
    await waitFor(() => expect(result.current.state).toEqual({ phase: 'matched', gameId: 'g9' }), {
      timeout: 4000,
    });
  });

  it('an idle status while searching re-joins with the same params (self-heal)', async () => {
    vi.mocked(joinMatchmaking).mockResolvedValue({ status: 'queued' });
    const { result } = renderHook(() => useMatchmaking());
    await act(() => result.current.join(PARAMS));

    vi.mocked(getMatchmakingStatus).mockResolvedValue({ status: 'idle' });
    await waitFor(() => expect(joinMatchmaking).toHaveBeenCalledTimes(2), { timeout: 4000 });
    expect(vi.mocked(joinMatchmaking).mock.calls[1]![0]).toEqual(PARAMS);
  });

  it('cancel leaves the queue and returns to idle', async () => {
    vi.mocked(joinMatchmaking).mockResolvedValueOnce({ status: 'queued' });
    const { result } = renderHook(() => useMatchmaking());
    await act(() => result.current.join(PARAMS));

    await act(() => result.current.cancel());

    expect(result.current.state).toEqual({ phase: 'idle' });
    expect(leaveMatchmaking).toHaveBeenCalledTimes(1);
  });

  it('unmount while searching leaves; unmount after match does not', async () => {
    vi.mocked(joinMatchmaking).mockResolvedValueOnce({ status: 'queued' });
    const first = renderHook(() => useMatchmaking());
    await act(() => first.result.current.join(PARAMS));
    first.unmount();
    expect(leaveMatchmaking).toHaveBeenCalledTimes(1);

    vi.mocked(leaveMatchmaking).mockClear();
    vi.mocked(joinMatchmaking).mockResolvedValueOnce({ status: 'matched', gameId: 'g1' });
    const second = renderHook(() => useMatchmaking());
    await act(() => second.result.current.join(PARAMS));
    second.unmount();
    expect(leaveMatchmaking).not.toHaveBeenCalled();
  });

  it('a 401 surfaces as an unauthenticated error', async () => {
    vi.mocked(joinMatchmaking).mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    );
    const { result } = renderHook(() => useMatchmaking());

    await act(() => result.current.join(PARAMS));

    expect(result.current.state).toEqual({
      phase: 'error',
      message: 'Unauthorized',
      unauthenticated: true,
    });
  });
});

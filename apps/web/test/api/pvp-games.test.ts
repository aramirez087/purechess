import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawPvpGame, abortPvpGame, rematchPvpGame } from '@/lib/api/pvp-games';

const BASE = 'http://localhost:4000/api';

const MOCK_STATE = {
  gameId: 'g1',
  fen: 'startpos',
  pgn: '',
  status: 'active',
  yourColor: 'white' as const,
  lastMove: null,
  ply: 0,
  result: null,
  resultReason: null,
  clock: null,
  timeControlSeconds: 300,
  incrementSeconds: 0,
};

function mockOkFetch(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_API_URL;
});

describe('pvp-games API wrappers', () => {
  it('drawPvpGame POSTs /games/:id/draw with the action', async () => {
    global.fetch = mockOkFetch(MOCK_STATE);
    const result = await drawPvpGame('g1', 'offer');
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/games/g1/draw`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ action: 'offer' }) }),
    );
    expect(result).toEqual(MOCK_STATE);
  });

  it('abortPvpGame POSTs /games/:id/abort', async () => {
    global.fetch = mockOkFetch(MOCK_STATE);
    const result = await abortPvpGame('g1');
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/games/g1/abort`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual(MOCK_STATE);
  });

  it('rematchPvpGame POSTs /games/:id/rematch with the action', async () => {
    global.fetch = mockOkFetch(MOCK_STATE);
    const result = await rematchPvpGame('g1', 'accept');
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/games/g1/rematch`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ action: 'accept' }) }),
    );
    expect(result).toEqual(MOCK_STATE);
  });

  it('surfaces the API error message on failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ message: 'No draw offer to accept' }),
    });
    await expect(drawPvpGame('g1', 'accept')).rejects.toThrow('No draw offer to accept');
  });
});

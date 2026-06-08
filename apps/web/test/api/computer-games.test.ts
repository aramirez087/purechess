import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  takebackComputerMove,
  rewindComputerGame,
  abortComputerGame,
  drawComputerGame,
  rematchComputerGame,
  createComputerGameFromFen,
} from '@/lib/api/computer-games';

const BASE = 'http://localhost:4000/api';

const MOCK_STATE = {
  gameId: 'g1',
  fen: 'startpos',
  pgn: '',
  status: 'active',
  computerColor: 'black' as const,
  computerLevel: 3,
  lastComputerMove: null,
  result: null,
  resultReason: null,
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

describe('computer-games API wrappers', () => {
  it('takebackComputerMove POSTs /computer-games/:id/takeback', async () => {
    global.fetch = mockOkFetch(MOCK_STATE);
    const result = await takebackComputerMove('g1', 2);
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/computer-games/g1/takeback`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ plies: 2 }) }),
    );
    expect(result).toEqual(MOCK_STATE);
  });

  it('rewindComputerGame POSTs /computer-games/:id/rewind', async () => {
    global.fetch = mockOkFetch(MOCK_STATE);
    const result = await rewindComputerGame('g1', 4);
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/computer-games/g1/rewind`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ ply: 4 }) }),
    );
    expect(result).toEqual(MOCK_STATE);
  });

  it('abortComputerGame POSTs /computer-games/:id/abort', async () => {
    global.fetch = mockOkFetch(MOCK_STATE);
    const result = await abortComputerGame('g1');
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/computer-games/g1/abort`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual(MOCK_STATE);
  });

  it('drawComputerGame POSTs /computer-games/:id/draw with action', async () => {
    global.fetch = mockOkFetch(MOCK_STATE);
    const result = await drawComputerGame('g1', 'offer');
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/computer-games/g1/draw`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ action: 'offer' }) }),
    );
    expect(result).toEqual(MOCK_STATE);
  });

  it('rematchComputerGame POSTs /computer-games/:id/rematch', async () => {
    global.fetch = mockOkFetch(MOCK_STATE);
    const result = await rematchComputerGame('g1', true);
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/computer-games/g1/rematch`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ swapColors: true }) }),
    );
    expect(result).toEqual(MOCK_STATE);
  });

  it('createComputerGameFromFen POSTs /computer-games/from-fen', async () => {
    global.fetch = mockOkFetch(MOCK_STATE);
    const payload = {
      level: 3 as const,
      color: 'white' as const,
      timeControlSeconds: 600,
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    };
    const result = await createComputerGameFromFen(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/computer-games/from-fen`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }),
    );
    expect(result).toEqual(MOCK_STATE);
  });

  it('apiFetch throws an Error with status on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () => Promise.resolve({ message: 'not allowed' }),
    });
    await expect(abortComputerGame('g1')).rejects.toMatchObject({
      message: 'not allowed',
      status: 403,
    });
  });
});

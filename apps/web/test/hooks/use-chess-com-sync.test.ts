import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChessComSync } from '@/hooks/use-chess-com-sync';

vi.mock('@/lib/api/chess-com', () => ({
  fetchChessComGames: vi.fn(),
  saveChessComMistakes: vi.fn(),
  completeChessComSync: vi.fn(),
}));

vi.mock('@/lib/chess-com/opening-analyzer', () => ({
  analyzeChessComGameOpening: vi.fn(),
}));

import {
  completeChessComSync,
  fetchChessComGames,
} from '@/lib/api/chess-com';

describe('useChessComSync', () => {
  beforeEach(() => {
    vi.mocked(fetchChessComGames).mockReset();
    vi.mocked(completeChessComSync).mockReset();
    vi.mocked(completeChessComSync).mockResolvedValue({
      username: 'hikaru',
      lastSyncedAt: '2026-06-20T00:00:00.000Z',
      gamesScanned: 0,
      mistakeCount: 0,
    });
  });

  it('surfaces a notice when chess.com returns no games', async () => {
    vi.mocked(fetchChessComGames).mockResolvedValue({
      username: 'hikaru',
      games: [],
      monthsFetched: 3,
    });

    const { result } = renderHook(() => useChessComSync());

    await act(async () => {
      await result.current.sync();
    });

    await waitFor(() => expect(result.current.state.running).toBe(false));
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.notice).toMatch(/no recent games found/i);
    expect(completeChessComSync).toHaveBeenCalledWith(0);
  });
});
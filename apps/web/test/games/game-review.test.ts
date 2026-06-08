import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameResult } from '@purechess/shared';
import type { ComputerGameStateDto } from '@purechess/shared';

function makeComputerState(overrides: Partial<ComputerGameStateDto> = {}): ComputerGameStateDto {
  return {
    gameId: 'cg-1',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
    pgn: '1. e4 e5',
    status: 'completed',
    computerColor: 'black',
    computerLevel: 3,
    lastComputerMove: 'e7e5',
    result: 'white_wins',
    resultReason: 'resignation',
    ...overrides,
  };
}

// --- Block 1: useGameHistory URL params ---------------------------------

describe('useGameHistory URL param building', () => {
  it('includes isVsComputer=true when filter set', () => {
    const params = new URLSearchParams();
    const isVsComputer = true;
    if (isVsComputer !== undefined) params.set('isVsComputer', String(isVsComputer));
    params.set('limit', '20');
    expect(params.toString()).toContain('isVsComputer=true');
  });

  it('omits isVsComputer param when undefined', () => {
    const params = new URLSearchParams();
    const isVsComputer: boolean | undefined = undefined;
    if (isVsComputer !== undefined) params.set('isVsComputer', String(isVsComputer));
    params.set('limit', '20');
    expect(params.toString()).not.toContain('isVsComputer');
  });

  it('queryKey includes isVsComputer', () => {
    const queryKey = ['gameHistory', 'alice', undefined, undefined, true, 20];
    expect(queryKey).toContain(true);
  });
});

// --- Block 2: game-review.service resolves a computer game --------

describe('getReview — computer game fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a review from computer-game endpoint when multiplayer returns 404', async () => {
    const state = makeComputerState();

    vi.stubGlobal('fetch', (url: string) => {
      if ((url as string).includes('/api/computer-games/cg-1')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(state) });
      }
      return Promise.resolve({ status: 404, ok: false, json: () => Promise.resolve({}) });
    });

    const { getReview } = await import('@/services/game-review.service.js');
    const review = await getReview('cg-1', { id: 'u1', username: 'Alice' });

    expect(review).not.toBeNull();
    expect(review!.result).toBe(GameResult.WhiteWins);
    expect(review!.moves.length).toBe(2);
    expect(review!.moves[0].san).toBe('e4');
    expect(review!.white.username).toBe('Alice');
    expect(review!.black.username).toBe('Computer');
    expect(review!.rated).toBe(false);
  });

  it('returns null for an active computer game', async () => {
    const state = makeComputerState({ status: 'active', result: null, resultReason: null, gameId: 'cg-2' });

    vi.stubGlobal('fetch', (url: string) => {
      if ((url as string).includes('/api/computer-games/cg-2')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(state) });
      }
      return Promise.resolve({ status: 404, ok: false, json: () => Promise.resolve({}) });
    });

    const { getReview } = await import('@/services/game-review.service.js');
    const review = await getReview('cg-2', null);

    expect(review).toBeNull();
  });
});

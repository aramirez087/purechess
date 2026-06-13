import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';

vi.mock('@/lib/api/puzzles', () => ({ getDailyPuzzle: vi.fn() }));
vi.mock('@/lib/board/sound', () => ({
  soundEngine: { play: vi.fn(), setEnabled: vi.fn() },
}));

import { usePuzzle, type UsePuzzleReturn } from '@/hooks/use-puzzle';
import { getDailyPuzzle, type LichessPuzzleData } from '@/lib/api/puzzles';
import { soundEngine } from '@/lib/board/sound';

// 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 — 6 plies; a6 (index 5) is the setup move, so
// the solver (White) is to move at the puzzle position. Lichess's initialPly is
// the 0-based index of that last move.
// Solution: Ba4 (b5a4) … b5 (b7b5) … Bb3 (a4b3).
const FIXTURE: LichessPuzzleData = {
  game: {
    id: 'g1',
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6',
    players: [],
  },
  puzzle: {
    id: 'P1',
    initialPly: 5,
    solution: ['b5a4', 'b7b5', 'a4b3'],
    rating: 1500,
    plays: 12345,
    themes: ['fork', 'middlegame'],
  },
};

const SETUP_MS = 600;
const AUTO_REPLY_MS = 500;

async function mountAtPlayer(): Promise<RenderHookResult<UsePuzzleReturn, unknown>> {
  const view = renderHook(() => usePuzzle());
  expect(view.result.current.state.phase).toBe('loading');
  // Flush the awaited fetch, then run the setup → player timer.
  await act(async () => {
    await Promise.resolve();
  });
  expect(view.result.current.state.phase).toBe('setup');
  act(() => {
    vi.advanceTimersByTime(SETUP_MS);
  });
  expect(view.result.current.state.phase).toBe('player');
  return view;
}

describe('usePuzzle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(getDailyPuzzle).mockResolvedValue(FIXTURE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in the loading phase', async () => {
    const { result } = renderHook(() => usePuzzle());
    expect(result.current.state.phase).toBe('loading');
    // Flush the mount-time load so its state update doesn't dangle past the test.
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('reaches the player phase with the solving color set', async () => {
    const { result } = await mountAtPlayer();
    expect(result.current.state.solvingColor).toBe('w');
    expect(result.current.state.moveIndex).toBe(0);
    expect(result.current.puzzleData?.puzzle.id).toBe('P1');
  });

  it('advances moveIndex on a correct move and auto-plays the reply', async () => {
    const { result } = await mountAtPlayer();

    act(() => {
      result.current.onMove('b5a4');
    });
    expect(result.current.state.phase).toBe('auto-reply');
    expect(result.current.state.moveIndex).toBe(1);

    act(() => {
      vi.advanceTimersByTime(AUTO_REPLY_MS);
    });
    expect(result.current.state.phase).toBe('player');
    expect(result.current.state.moveIndex).toBe(2);
  });

  it('transitions to fail on a wrong move', async () => {
    const { result } = await mountAtPlayer();

    act(() => {
      result.current.onMove('e2e4');
    });
    expect(result.current.state.phase).toBe('fail');
    expect(soundEngine.play).toHaveBeenCalledWith('error');
  });

  it('reaches success on the final correct move', async () => {
    const { result } = await mountAtPlayer();

    act(() => {
      result.current.onMove('b5a4');
    });
    act(() => {
      vi.advanceTimersByTime(AUTO_REPLY_MS);
    });
    act(() => {
      result.current.onMove('a4b3');
    });

    expect(result.current.state.phase).toBe('success');
    expect(soundEngine.play).toHaveBeenCalledWith('success');
  });

  it('moves from fail to reveal via onReveal', async () => {
    const { result } = await mountAtPlayer();

    act(() => {
      result.current.onMove('e2e4');
    });
    expect(result.current.state.phase).toBe('fail');

    act(() => {
      result.current.onReveal();
    });
    expect(result.current.state.phase).toBe('reveal');
  });
});

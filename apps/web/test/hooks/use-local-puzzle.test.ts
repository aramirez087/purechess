import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('@/lib/board/sound', () => ({
  soundEngine: { play: vi.fn(), setEnabled: vi.fn() },
}));

import { useLocalPuzzle } from '@/hooks/use-local-puzzle';
import { soundEngine } from '@/lib/board/sound';
import type { PuzzleDto } from '@purechess/shared';

const AUTO_REPLY_MS = 500;

// White to move with kingside castling available. A DB puzzle: `fen` IS the
// start position, moves[0] is the SOLVER's first move (lichess uses the
// rook-square castle form e1h1, which uciMatch normalizes to e1g1).
//   moves[0] = e1h1  (solver castles)
//   moves[1] = d7d6  (opponent scripted reply)
//   moves[2] = f3g5  (solver finishes)
const PUZZLE: PuzzleDto = {
  id: 'pz-castle-1',
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B5/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
  moves: ['e1h1', 'd7d6', 'f3g5'],
  rating: 1500,
  themes: ['fork'],
};

// Black to move — proves solvingColor comes from the FEN active-color field.
const BLACK_PUZZLE: PuzzleDto = {
  id: 'pz-black-1',
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B5/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1',
  moves: ['d7d6'],
  rating: 1500,
  themes: ['fork'],
};

describe('useLocalPuzzle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in the player phase with no setup phase', () => {
    const { result } = renderHook(() => useLocalPuzzle({ puzzle: PUZZLE }));
    expect(result.current.state.phase).toBe('player');
    expect(result.current.state.fen).toBe(PUZZLE.fen);
    expect(result.current.state.moveIndex).toBe(0);
    expect(result.current.state.lastMove).toBeNull();
  });

  it('derives solvingColor from the FEN active-color field', () => {
    const white = renderHook(() => useLocalPuzzle({ puzzle: PUZZLE }));
    expect(white.result.current.state.solvingColor).toBe('w');

    const black = renderHook(() => useLocalPuzzle({ puzzle: BLACK_PUZZLE }));
    expect(black.result.current.state.solvingColor).toBe('b');
  });

  it('matches a castling UCI in rook-square form (e1h1 == e1g1)', () => {
    const onSolved = vi.fn();
    const { result } = renderHook(() => useLocalPuzzle({ puzzle: PUZZLE, onSolved }));

    // The solution stores e1h1; the board emits the king-destination e1g1.
    act(() => {
      result.current.onMove('e1g1');
    });
    // Correct first move advances to the auto-reply, not fail.
    expect(result.current.state.phase).toBe('auto-reply');
    expect(result.current.state.moveIndex).toBe(1);
    expect(onSolved).not.toHaveBeenCalled();
  });

  it('runs the full correct sequence to success and records msToSolve', () => {
    const onSolved = vi.fn();
    const { result } = renderHook(() => useLocalPuzzle({ puzzle: PUZZLE, onSolved }));

    act(() => {
      result.current.onMove('e1g1'); // solver move[0]
    });
    expect(result.current.state.phase).toBe('auto-reply');

    // Advance ~1.2s of fake clock so the auto-reply fires AND msToSolve is > 0.
    act(() => {
      vi.advanceTimersByTime(AUTO_REPLY_MS);
    });
    expect(result.current.state.phase).toBe('player');
    expect(result.current.state.moveIndex).toBe(2);

    act(() => {
      result.current.onMove('f3g5'); // solver move[2] -> solved
    });

    expect(result.current.state.phase).toBe('success');
    expect(soundEngine.play).toHaveBeenCalledWith('success');
    expect(onSolved).toHaveBeenCalledTimes(1);
    const arg = onSolved.mock.calls[0][0] as { msToSolve: number };
    expect(arg.msToSolve).toBeGreaterThanOrEqual(AUTO_REPLY_MS);
  });

  it('transitions to fail on a wrong move and fires onFailed once', () => {
    const onFailed = vi.fn();
    const onSolved = vi.fn();
    const { result } = renderHook(() =>
      useLocalPuzzle({ puzzle: PUZZLE, onFailed, onSolved }),
    );

    act(() => {
      result.current.onMove('b1c3'); // legal, but not the solution
    });

    expect(result.current.state.phase).toBe('fail');
    expect(soundEngine.play).toHaveBeenCalledWith('error');
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onSolved).not.toHaveBeenCalled();
  });

  it('steps the rest of the solution from fail via onReveal', () => {
    const { result } = renderHook(() => useLocalPuzzle({ puzzle: PUZZLE }));

    act(() => {
      result.current.onMove('b1c3'); // wrong -> fail
    });
    expect(result.current.state.phase).toBe('fail');

    act(() => {
      result.current.onReveal();
    });
    expect(result.current.state.phase).toBe('reveal');
  });
});

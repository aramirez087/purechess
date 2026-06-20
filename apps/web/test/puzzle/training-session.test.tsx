import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { PuzzleDto, PuzzleThemeStatDto } from '@purechess/shared';

// --- Mocks ------------------------------------------------------------------

vi.mock('@/lib/board/sound', () => ({
  soundEngine: { play: vi.fn(), setEnabled: vi.fn() },
}));

// BoardSettingsProvider is a context wrapper — render children directly.
vi.mock('@/components/board/board-context', () => ({
  BoardSettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Replace the real board with a button that fires the solving move when pressed.
// `currentMove` is updated by each test to the move the board should emit.
let currentMove = '';
vi.mock('@/components/board/chessboard', () => ({
  Chessboard: ({ onMove }: { onMove?: (m: { from: string; to: string }) => void }) => (
    <button
      type="button"
      data-testid="solve-btn"
      onClick={() =>
        onMove?.({ from: currentMove.slice(0, 2), to: currentMove.slice(2, 4) })
      }
    >
      board
    </button>
  ),
}));

vi.mock('@/lib/api/puzzles', () => ({
  fetchNextPuzzle: vi.fn(),
  recordAttempt: vi.fn(),
  fetchPuzzleStats: vi.fn(),
}));

import { TrainingSession } from '@/components/puzzle/training-session';
import { fetchNextPuzzle, fetchPuzzleStats, recordAttempt } from '@/lib/api/puzzles';

// Single-move solve: White to move, moves[0] is the only (solver) move, so one
// correct move completes the puzzle and (with target 1) the session.
const SOLVE_MOVE = 'f3g5';
const PUZZLE: PuzzleDto = {
  id: 'pz-1',
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B5/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
  moves: [SOLVE_MOVE],
  rating: 1480,
  themes: ['fork'],
};

function statsAt(accuracy: number): PuzzleThemeStatDto[] {
  return [{ slug: 'fork', attempts: 10, solved: Math.round(accuracy * 10), accuracy }];
}

describe('TrainingSession', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    currentMove = SOLVE_MOVE;
    vi.mocked(fetchNextPuzzle).mockResolvedValue(PUZZLE);
    vi.mocked(recordAttempt).mockResolvedValue({
      puzzleId: 'pz-1',
      solved: true,
      ratingBefore: 1500,
      ratingAfter: 1512,
      ratingDelta: 12,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts recordAttempt with the right source on a solve', async () => {
    vi.mocked(fetchPuzzleStats).mockResolvedValue(statsAt(0.5));

    render(<TrainingSession theme="fork" source="theme" target={1} />);

    const btn = await screen.findByTestId('solve-btn');
    act(() => {
      btn.click();
    });

    await waitFor(() => {
      expect(recordAttempt).toHaveBeenCalledTimes(1);
    });
    const [puzzleId, body] = vi.mocked(recordAttempt).mock.calls[0];
    expect(puzzleId).toBe('pz-1');
    expect(body.solved).toBe(true);
    expect(body.source).toBe('theme');
    expect(typeof body.msToSolve).toBe('number');
  });

  it('passes the source through verbatim (rush)', async () => {
    vi.mocked(fetchPuzzleStats).mockResolvedValue([]);

    render(<TrainingSession theme={null} source="rush" target={1} />);
    const btn = await screen.findByTestId('solve-btn');
    act(() => {
      btn.click();
    });

    await waitFor(() => expect(recordAttempt).toHaveBeenCalledTimes(1));
    expect(vi.mocked(recordAttempt).mock.calls[0][1].source).toBe('rush');
  });

  it('auto-advances to the next puzzle after a solve below target', async () => {
    vi.mocked(fetchPuzzleStats).mockResolvedValue(statsAt(0.5));

    render(<TrainingSession theme="fork" source="theme" target={5} />);

    const btn = await screen.findByTestId('solve-btn');
    // First puzzle fetched on mount.
    expect(fetchNextPuzzle).toHaveBeenCalledTimes(1);

    act(() => {
      btn.click();
    });
    await waitFor(() => expect(recordAttempt).toHaveBeenCalledTimes(1));

    // After the ~1.2s auto-advance, the next puzzle is fetched (target not hit).
    await waitFor(() => expect(fetchNextPuzzle).toHaveBeenCalledTimes(2), {
      timeout: 3000,
    });
  });

  it('shows a session summary with before/after theme accuracy at target', async () => {
    // Stats are fetched at session start (before) and again at completion (after).
    vi.mocked(fetchPuzzleStats)
      .mockResolvedValueOnce(statsAt(0.5)) // before: 50%
      .mockResolvedValueOnce(statsAt(0.7)); // after: 70%

    render(<TrainingSession theme="fork" source="theme" target={1} />);

    const btn = await screen.findByTestId('solve-btn');
    act(() => {
      btn.click();
    });

    // Summary appears once the target (1 solve) is hit and the after-stats land.
    const summary = await screen.findByTestId('session-summary', {}, { timeout: 3000 });
    expect(summary).toBeTruthy();
    expect(summary.textContent).toContain('50%'); // before
    expect(summary.textContent).toContain('70%'); // after
    // accuracy moved +20 points
    expect(screen.getByTestId('accuracy-delta').textContent).toContain('20');
  });
});

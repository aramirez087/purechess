import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { PuzzleDto, RushStartResponseDto } from '@purechess/shared';

// --- Mocks ------------------------------------------------------------------

vi.mock('@/lib/board/sound', () => ({
  soundEngine: { play: vi.fn(), setEnabled: vi.fn() },
}));

vi.mock('@/components/board/board-context', () => ({
  BoardSettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  // RushHud reads board settings to honor the "animations off" switch.
  useBoardSettings: () => ({
    settings: { sound: true, coordinates: false, animationMs: 200 },
    updateSettings: () => {},
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// The board is a button that emits a move. `currentMove` is set per test to
// either the correct solving move or a wrong one.
let currentMove = '';
vi.mock('@/components/board/chessboard', () => ({
  Chessboard: ({
    onMove,
    readOnly,
  }: {
    onMove?: (m: { from: string; to: string }) => void;
    readOnly?: boolean;
  }) => (
    <button
      type="button"
      data-testid="solve-btn"
      disabled={readOnly}
      onClick={() => onMove?.({ from: currentMove.slice(0, 2), to: currentMove.slice(2, 4) })}
    >
      board
    </button>
  ),
}));

vi.mock('@/lib/api/puzzles', () => ({
  startRush: vi.fn(),
  finishRush: vi.fn(),
  recordAttempt: vi.fn(),
}));

import { RushClient } from '@/app/puzzles/rush/rush-client';
import { finishRush, recordAttempt, startRush } from '@/lib/api/puzzles';

// Each puzzle is a single solver move so one correct click solves it and
// advances instantly. The FEN is the standard start (White to move) and the
// move is a legal pawn push, so `applyUci` succeeds. Ratings escalate
// (cosmetic for the client).
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
function puzzle(id: string, move: string, rating: number): PuzzleDto {
  return { id, fen: START_FEN, moves: [move], rating, themes: ['fork'] };
}

const SET: PuzzleDto[] = [
  puzzle('pz-0', 'a2a3', 1300),
  puzzle('pz-1', 'b2b3', 1320),
  puzzle('pz-2', 'c2c3', 1340),
  puzzle('pz-3', 'd2d3', 1360),
  puzzle('pz-4', 'e2e3', 1380),
  puzzle('pz-5', 'f2f3', 1400),
];

const START_RESPONSE: RushStartResponseDto = { runId: 'run-1', puzzles: SET, mode: '3min' };

async function startRunning() {
  // Click "Start" to enter the run; the set fetch resolves async.
  const startBtn = await screen.findByTestId('rush-start');
  await act(async () => {
    startBtn.click();
  });
  // Let the startRush promise resolve and the board render.
  await screen.findByTestId('solve-btn');
}

describe('RushClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(startRush).mockResolvedValue(START_RESPONSE);
    vi.mocked(finishRush).mockResolvedValue({ best: 5, isPB: true, mode: '3min' });
    vi.mocked(recordAttempt).mockResolvedValue({
      puzzleId: 'pz-0',
      solved: true,
      ratingBefore: 1500,
      ratingAfter: 1505,
      ratingDelta: 5,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a sign-in prompt when signed out', () => {
    render(<RushClient signedIn={false} initialBests={{ '3min': 0, '5strikes': 0 }} />);
    expect(screen.getByRole('link', { name: /sign in to play/i })).toBeTruthy();
    expect(screen.queryByTestId('rush-start')).toBeNull();
  });

  it('a correct answer increments the score and combo, posting source "rush"', async () => {
    render(<RushClient signedIn initialBests={{ '3min': 0, '5strikes': 0 }} />);
    await startRunning();

    expect(screen.getByTestId('rush-score').textContent).toBe('0');

    currentMove = 'a2a3'; // matches pz-0
    await act(async () => {
      screen.getByTestId('solve-btn').click();
    });

    await waitFor(() => expect(screen.getByTestId('rush-score').textContent).toBe('1'));
    expect(screen.getByTestId('rush-combo').textContent).toContain('1');

    // The solved puzzle was reported with source 'rush' (fire-and-forget).
    await waitFor(() => expect(recordAttempt).toHaveBeenCalled());
    const [puzzleId, body] = vi.mocked(recordAttempt).mock.calls[0];
    expect(puzzleId).toBe('pz-0');
    expect(body.solved).toBe(true);
    expect(body.source).toBe('rush');
  });

  it('a wrong answer adds a strike, resets the combo, and advances', async () => {
    render(<RushClient signedIn initialBests={{ '3min': 0, '5strikes': 0 }} />);
    await startRunning();

    // First, a correct one to build a combo.
    currentMove = 'a2a3';
    await act(async () => {
      screen.getByTestId('solve-btn').click();
    });
    await waitFor(() => expect(screen.getByTestId('rush-combo').textContent).toContain('1'));

    // Now a wrong move on pz-1 (any non-matching move).
    currentMove = 'h2h4';
    await act(async () => {
      screen.getByTestId('solve-btn').click();
    });

    // Combo resets to 0; score stays at 1; a failing attempt is reported.
    await waitFor(() => expect(screen.getByTestId('rush-combo').textContent).toContain('0'));
    expect(screen.getByTestId('rush-score').textContent).toBe('1');
    await waitFor(() => {
      const failCall = vi.mocked(recordAttempt).mock.calls.find((c) => c[1].solved === false);
      expect(failCall).toBeTruthy();
      expect(failCall![1].source).toBe('rush');
    });
  });

  it('ends the run when the 3-minute clock reaches zero, recording the score', async () => {
    vi.useFakeTimers();
    render(<RushClient signedIn initialBests={{ '3min': 0, '5strikes': 0 }} />);

    // Enter the run (advance fake timers across the async set fetch).
    const startBtn = await vi.waitFor(() => screen.getByTestId('rush-start'));
    await act(async () => {
      startBtn.click();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Run the clock past 3 minutes; the tick interval fires and ends the run.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000 + 500);
    });

    await vi.waitFor(() => expect(finishRush).toHaveBeenCalledTimes(1));
    const arg = vi.mocked(finishRush).mock.calls[0][0];
    expect(arg.mode).toBe('3min');
    expect(arg.score).toBe(0); // no solves this run
    expect(typeof arg.durationMs).toBe('number');
  });

  it('ends the run after 5 strikes in 5strikes mode', async () => {
    vi.mocked(startRush).mockResolvedValue({
      runId: 'run-2',
      puzzles: SET,
      mode: '5strikes',
    });
    render(<RushClient signedIn initialBests={{ '3min': 0, '5strikes': 0 }} />);

    // Switch to 5strikes mode, then start.
    await act(async () => {
      screen.getByRole('button', { name: /5 strikes/i }).click();
    });
    await startRunning();

    // Five consecutive wrong moves end the run.
    currentMove = 'h2h4'; // never matches
    for (let i = 0; i < 5; i++) {
      const btn = screen.queryByTestId('solve-btn');
      if (!btn) break;
      await act(async () => {
        btn.click();
      });
    }

    await waitFor(() => expect(finishRush).toHaveBeenCalledTimes(1));
    expect(vi.mocked(finishRush).mock.calls[0][0].mode).toBe('5strikes');
    // The summary shows after the run ends.
    expect(await screen.findByTestId('rush-summary')).toBeTruthy();
  });

  it('celebrates a new personal best on the post-run summary', async () => {
    render(<RushClient signedIn initialBests={{ '3min': 0, '5strikes': 0 }} />);
    await startRunning();

    // End the run via the "End run" control; finishRush reports a PB.
    await act(async () => {
      screen.getByTestId('rush-end').click();
    });

    const summary = await screen.findByTestId('rush-summary');
    expect(summary).toBeTruthy();
    expect(screen.getByTestId('rush-pb-badge').textContent).toMatch(/new record/i);
  });
});

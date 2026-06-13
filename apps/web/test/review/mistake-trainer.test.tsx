import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { MistakeItem } from '@/components/review/mistake-trainer';

// --- Mocks -----------------------------------------------------------------

// Sound engine touches the Web Audio API — stub it.
vi.mock('@/lib/board/sound', () => ({
  soundEngine: { play: vi.fn() },
}));

// The board is mocked to a thin surface that records the FEN it was handed and
// lets the test inject a player move via a button (no DOM drag-drop needed).
const lastBoardFen = { value: '' };
vi.mock('@/components/board/chessboard', () => ({
  Chessboard: ({
    position,
    onMove,
    readOnly,
  }: {
    position: string;
    onMove?: (m: { from: string; to: string; promotion?: string }) => void;
    readOnly?: boolean;
  }) => {
    lastBoardFen.value = position;
    return (
      <div data-testid="board" data-position={position} data-readonly={String(!!readOnly)}>
        <button type="button" data-testid="play-solution" onClick={() => onMove?.({ from: 'g1', to: 'f3' })}>
          solve
        </button>
        <button type="button" data-testid="play-wrong" onClick={() => onMove?.({ from: 'd2', to: 'd4' })}>
          wrong
        </button>
      </div>
    );
  },
}));

const fetchMistakes = vi.fn();
const markMistakeReviewed = vi.fn();
vi.mock('@/lib/api/puzzles', () => ({
  fetchMistakes: (...args: unknown[]) => fetchMistakes(...args),
  markMistakeReviewed: (...args: unknown[]) => markMistakeReviewed(...args),
}));

import { MistakeTrainer } from '@/components/review/mistake-trainer';

// Position after 1.e4 e5 — White to move (a real, legal FEN; bug-522). The
// "solution" the user missed is g1f3 (legal in this position).
const FEN_BEFORE = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

const MISTAKE: MistakeItem = {
  ply: 3,
  moveNumber: 2,
  color: 'w',
  san: 'Qh5',
  fen: FEN_BEFORE,
  bestLineUci: ['g1f3'],
  cpLoss: 340,
};

describe('MistakeTrainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMistakes.mockResolvedValue([
      { id: 'mistake-row-1', gameId: 'g1', ply: 3, fen: FEN_BEFORE, playedUci: 'd1h5', bestUci: 'g1f3', bestLineUci: ['g1f3'], cpLoss: 340, themeGuess: [], reviewed: false, createdAt: '2026-06-01T00:00:00.000Z' },
    ]);
    markMistakeReviewed.mockResolvedValue({ next: null });
  });

  it('renders nothing when there are no mistakes', () => {
    const { container } = render(<MistakeTrainer gameId="g1" mistakes={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('lists this game’s mistakes with the move label and the −cp readout', () => {
    render(<MistakeTrainer gameId="g1" mistakes={[MISTAKE]} />);
    expect(screen.getByText(/Move 2\. Qh5/)).toBeTruthy();
    // 340 cp lost → "−3.4".
    expect(screen.getByText('−3.4')).toBeTruthy();
  });

  it('clicking a mistake starts the solve from the position BEFORE the blunder', () => {
    render(<MistakeTrainer gameId="g1" mistakes={[MISTAKE]} />);
    fireEvent.click(screen.getByText(/Move 2\. Qh5/));
    // The board renders the before-blunder FEN — the user solves from there.
    const board = screen.getByTestId('board');
    expect(board.getAttribute('data-position')).toBe(FEN_BEFORE);
    expect(screen.getByText('Find the move you missed.')).toBeTruthy();
  });

  it('solving the best line marks the mistake reviewed (by resolved id)', async () => {
    render(<MistakeTrainer gameId="g1" mistakes={[MISTAKE]} />);
    // fetchMistakes resolves the ply→id map.
    await waitFor(() => expect(fetchMistakes).toHaveBeenCalled());

    fireEvent.click(screen.getByText(/Move 2\. Qh5/));
    fireEvent.click(screen.getByTestId('play-solution'));

    // Inline success feedback.
    await screen.findByText('You found it');
    // And the persisted row was marked reviewed via its resolved id.
    await waitFor(() => expect(markMistakeReviewed).toHaveBeenCalledWith('mistake-row-1'));
  });

  it('a wrong move does NOT mark reviewed', async () => {
    render(<MistakeTrainer gameId="g1" mistakes={[MISTAKE]} />);
    await waitFor(() => expect(fetchMistakes).toHaveBeenCalled());

    fireEvent.click(screen.getByText(/Move 2\. Qh5/));
    fireEvent.click(screen.getByTestId('play-wrong'));

    await screen.findByText(/Not the move/);
    expect(markMistakeReviewed).not.toHaveBeenCalled();
  });

  it('does not call markReviewed when no persisted id matches the ply', async () => {
    fetchMistakes.mockResolvedValue([]); // capture not landed yet
    render(<MistakeTrainer gameId="g1" mistakes={[MISTAKE]} />);
    await waitFor(() => expect(fetchMistakes).toHaveBeenCalled());

    fireEvent.click(screen.getByText(/Move 2\. Qh5/));
    fireEvent.click(screen.getByTestId('play-solution'));

    await screen.findByText('You found it'); // solve still works visually
    expect(markMistakeReviewed).not.toHaveBeenCalled();
  });
});

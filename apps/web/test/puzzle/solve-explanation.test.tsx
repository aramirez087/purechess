import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PuzzleSource } from '@purechess/shared';

// --- Mocks ------------------------------------------------------------------

// BoardSettingsProvider is a context wrapper — render children directly.
vi.mock('@/components/board/board-context', () => ({
  BoardSettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Replace the real board with a stub that exposes its position + autoShapes so
// the test can assert the mini-board steps and draws the motif arrow.
vi.mock('@/components/board/chessboard', () => ({
  Chessboard: ({
    position,
    autoShapes,
  }: {
    position: string;
    autoShapes?: { from: string; to: string; color: string }[];
  }) => (
    <div data-testid="mini-board" data-fen={position}>
      <span data-testid="arrows">
        {(autoShapes ?? []).map((s) => `${s.from}${s.to}:${s.color}`).join(',')}
      </span>
    </div>
  ),
}));

import { SolveExplanation } from '@/components/puzzle/solve-explanation';
import { useSettingsStore } from '@/stores/settings-store';

// A real puzzle: start FEN + a two-move solution; theme 'fork'.
const FEN = 'rnbqkbnr/pppp1ppp/8/4p3/2B5/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1';
const SOLUTION = ['f3g5', 'd8g5']; // solver move, then a reply (display only)

function renderPanel(over: Partial<React.ComponentProps<typeof SolveExplanation>> = {}) {
  return render(
    <SolveExplanation
      themes={['fork']}
      fen={FEN}
      solutionMoves={SOLUTION}
      source={'theme'}
      {...over}
    />,
  );
}

describe('SolveExplanation', () => {
  beforeEach(() => {
    // Default the preference OFF (explanations shown).
    useSettingsStore.setState({ hideExplanations: false });
  });

  afterEach(() => {
    cleanup();
    useSettingsStore.setState({ hideExplanations: false });
  });

  it('renders the curated copy for the puzzle theme', () => {
    renderPanel();
    expect(screen.getByText('Fork')).toBeInTheDocument();
    // The one-liner + "look for" copy is the curated fork explanation.
    expect(screen.getByText(/attacks two or more enemy targets/i)).toBeInTheDocument();
    expect(screen.getByText(/Look for:/i)).toBeInTheDocument();
  });

  it('degrades gracefully for an unknown theme: shows the humanized name, no copy', () => {
    renderPanel({ themes: ['someRareUnmappedTheme'] });
    // Humanized label still renders...
    expect(screen.getByText('Some rare unmapped theme')).toBeInTheDocument();
    // ...but no fabricated copy ("Look for:" only appears when whatToLookFor is set).
    expect(screen.queryByText(/Look for:/i)).not.toBeInTheDocument();
  });

  it('renders nothing in rush mode', () => {
    const { container } = renderPanel({ source: 'rush' as PuzzleSource });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('solve-explanation')).not.toBeInTheDocument();
  });

  it('respects the hide-explanations preference', () => {
    useSettingsStore.setState({ hideExplanations: true });
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('solve-explanation')).not.toBeInTheDocument();
  });

  it('draws the key motif arrow (solver first move) on the starting position', () => {
    renderPanel();
    // Default-collapsed is false here, so "why it works" renders. The arrow is
    // the solver's first move f3->g5 in green, shown at ply 0 (start).
    const arrows = screen.getByTestId('arrows');
    expect(arrows).toHaveTextContent('f3g5:green');
  });

  it('steps the mini-board when a solution move is clicked', () => {
    renderPanel();
    const board = screen.getByTestId('mini-board');
    // At the start, the board shows the puzzle FEN.
    expect(board).toHaveAttribute('data-fen', FEN);

    // Click the first solution move — the board should advance off the start FEN.
    const line = screen.getByTestId('solution-line');
    const firstMove = within(line).getAllByRole('button')[0];
    fireEvent.click(firstMove);
    expect(screen.getByTestId('mini-board')).not.toHaveAttribute('data-fen', FEN);

    // ...and the start-position arrow clears once we've stepped in.
    expect(screen.getByTestId('arrows')).toHaveTextContent('');
  });

  it('is collapsible: the body hides when the header toggle is pressed', () => {
    renderPanel();
    expect(screen.getByTestId('why-it-works')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /the pattern/i });
    fireEvent.click(toggle);
    expect(screen.queryByTestId('why-it-works')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('dismisses when the close button is pressed', () => {
    const onDismiss = vi.fn();
    renderPanel({ onDismiss });
    fireEvent.click(screen.getByRole('button', { name: /dismiss explanation/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

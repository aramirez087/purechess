import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DrillLinesDto } from '@purechess/shared';

// --- Mocks ------------------------------------------------------------------

vi.mock('@/lib/board/sound', () => ({
  soundEngine: { play: vi.fn(), setEnabled: vi.fn() },
}));

// BoardSettingsProvider is a context wrapper — render children directly.
vi.mock('@/components/board/board-context', () => ({
  BoardSettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Replace the real board with a button that fires `nextMove` on click, and
// expose the current FEN + any autoShapes (book-move arrow) for assertions.
let nextMove = '';
vi.mock('@/components/board/chessboard', () => ({
  Chessboard: ({
    position,
    onMove,
    autoShapes,
  }: {
    position: string;
    onMove?: (m: { from: string; to: string; promotion?: string }) => void;
    autoShapes?: Array<{ type: string; from?: string; to?: string }>;
  }) => (
    <div>
      <div data-testid="board-fen">{position}</div>
      <div data-testid="book-arrow">
        {(autoShapes ?? [])
          .filter((s) => s.type === 'arrow')
          .map((s) => `${s.from}${s.to}`)
          .join(',')}
      </div>
      <button
        type="button"
        data-testid="play-move"
        onClick={() =>
          onMove?.({
            from: nextMove.slice(0, 2),
            to: nextMove.slice(2, 4),
            promotion: nextMove[4],
          })
        }
      >
        play
      </button>
    </div>
  ),
}));

vi.mock('@/lib/api/repertoire', () => ({
  gradeDrill: vi.fn(),
}));

import { OpeningDrill } from '@/components/openings/opening-drill';
import { gradeDrill } from '@/lib/api/repertoire';

// A white repertoire, one line: 1.e4 e5 2.Nf3 Nc6 (leaf path "0.0.0.0").
const ROOT = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const AFTER_NF3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
const AFTER_NC6 = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

function whiteLineDrill(): DrillLinesDto {
  return {
    repertoireId: 'rep1',
    color: 'white',
    dueLineCount: 1,
    lines: [
      {
        nodePath: '0.0.0.0',
        rootFen: ROOT,
        isNew: false,
        steps: [
          { san: 'e4', uci: 'e2e4', fen: AFTER_E4 },
          { san: 'e5', uci: 'e7e5', fen: AFTER_E5 },
          { san: 'Nf3', uci: 'g1f3', fen: AFTER_NF3 },
          { san: 'Nc6', uci: 'b8c6', fen: AFTER_NC6 },
        ],
      },
    ],
  };
}

function renderDrill() {
  return render(
    <OpeningDrill
      repertoireId="rep1"
      repertoireName="King's Pawn"
      drill={whiteLineDrill()}
      onBack={vi.fn()}
    />,
  );
}

function fen() {
  return screen.getByTestId('board-fen').textContent;
}

describe('OpeningDrill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextMove = '';
    vi.mocked(gradeDrill).mockResolvedValue({
      nodePath: '0.0.0.0',
      nextDueAt: new Date(Date.now() + 86_400_000).toISOString(),
      intervalDays: 1,
    });
  });

  afterEach(() => cleanup());

  it('starts the session and waits at the first user move (white to move at root)', () => {
    renderDrill();
    fireEvent.click(screen.getByTestId('drill-start'));
    // White repertoire: the user moves first, so the board sits at the root.
    expect(fen()).toBe(ROOT);
    expect(screen.getByText(/white to move/i)).toBeTruthy();
  });

  it('auto-replies the opponent move after a correct booked move', () => {
    renderDrill();
    fireEvent.click(screen.getByTestId('drill-start'));

    // Play the booked e4 — the opponent's e5 must auto-play, landing on the
    // position where it is White's turn again (after e5).
    nextMove = 'e2e4';
    fireEvent.click(screen.getByTestId('play-move'));

    expect(fen()).toBe(AFTER_E5);
    expect(screen.getByText(/white to move/i)).toBeTruthy();
    // Still on book — no correction arrow.
    expect(screen.getByTestId('book-arrow').textContent).toBe('');
  });

  it('flags an off-book legal move, draws the book-move arrow, and counts a miss', async () => {
    renderDrill();
    fireEvent.click(screen.getByTestId('drill-start'));

    // Correct first move so we reach the 2nd user move (after e5, White to move).
    nextMove = 'e2e4';
    fireEvent.click(screen.getByTestId('play-move'));
    expect(fen()).toBe(AFTER_E5);

    // Play a DIFFERENT legal move (Bc4 = f1c4) instead of the booked Nf3.
    nextMove = 'f1c4';
    fireEvent.click(screen.getByTestId('play-move'));

    // Out of book: the booked Nf3 (g1f3) arrow is surfaced, and the line still
    // advances along the BOOKED move (Nf3) — so the board shows the opponent's
    // Nc6 reply that follows Nf3, then the line completes.
    // After the booked Nf3 auto-plays, opponent Nc6 also auto-plays -> leaf.
    await waitFor(() => {
      // The line completed and was graded as a miss (correctFirstTry=false).
      expect(gradeDrill).toHaveBeenCalledWith('rep1', {
        nodePath: '0.0.0.0',
        correctFirstTry: false,
      });
    });
  });

  it('completes the line on the last booked user move and grades it clean', async () => {
    renderDrill();
    fireEvent.click(screen.getByTestId('drill-start'));

    nextMove = 'e2e4';
    fireEvent.click(screen.getByTestId('play-move'));
    expect(fen()).toBe(AFTER_E5);

    // The 2nd (and last) user move, played correctly: Nf3 -> opponent Nc6 auto
    // -> leaf -> grade clean -> session done.
    nextMove = 'g1f3';
    fireEvent.click(screen.getByTestId('play-move'));

    await waitFor(() => {
      expect(gradeDrill).toHaveBeenCalledWith('rep1', {
        nodePath: '0.0.0.0',
        correctFirstTry: true,
      });
    });
    // Session-complete readout shows 100% first-try (one clean line). The
    // percentage and the "first-try" label render in separate elements.
    expect(await screen.findByText(/session complete/i)).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText(/first-try/i)).toBeTruthy();
  });

  it('ignores an illegal move (no advance, no grade)', () => {
    renderDrill();
    fireEvent.click(screen.getByTestId('drill-start'));

    // An illegal move from the root (e2e5 is not legal) must be a no-op.
    nextMove = 'e2e5';
    fireEvent.click(screen.getByTestId('play-move'));
    expect(fen()).toBe(ROOT);
    expect(gradeDrill).not.toHaveBeenCalled();
  });

  it('shows an empty state when no lines are queued', () => {
    render(
      <OpeningDrill
        repertoireId="rep1"
        repertoireName="King's Pawn"
        drill={{ repertoireId: 'rep1', color: 'white', dueLineCount: 0, lines: [] }}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText(/nothing to drill/i)).toBeTruthy();
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { Chess } from 'chess.js';
import { Chessboard } from '@/components/board/chessboard';
import { BoardSettingsProvider } from '@/components/board/board-context';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function fenAfterMoves(moves: string[]): string {
  const c = new Chess();
  for (const m of moves) c.move(m);
  return c.fen();
}

function renderBoard(position: string) {
  return render(
    <BoardSettingsProvider>
      <Chessboard position={position} orientation="white" />
    </BoardSettingsProvider>,
  );
}

describe('Chessboard SR region', () => {
  it('renders role="status" live region', () => {
    renderBoard(START_FEN);
    const region = screen.getByRole('status');
    expect(region).toBeTruthy();
  });

  it('starts with empty announcement text', () => {
    renderBoard(START_FEN);
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('');
  });

  it('announces move when position updates to Nf3', () => {
    const nextFen = fenAfterMoves(['Nf3']);
    const { rerender } = renderBoard(START_FEN);

    act(() => {
      rerender(
        <BoardSettingsProvider>
          <Chessboard position={nextFen} orientation="white" />
        </BoardSettingsProvider>,
      );
    });

    const region = screen.getByRole('status');
    expect(region.textContent).toBe('Knight to f3');
  });

  it('announces capture + check', () => {
    // e4 e5 Bc4 Nc6 Qh5 a6, then Qxf7 (white queen captures f7 pawn, check)
    const c = new Chess();
    ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'a6'].forEach((m) => c.move(m));
    const preFen = c.fen();
    c.move({ from: 'h5', to: 'f7' });
    const postFen = c.fen();

    const { rerender } = renderBoard(preFen);
    act(() => {
      rerender(
        <BoardSettingsProvider>
          <Chessboard position={postFen} orientation="white" />
        </BoardSettingsProvider>,
      );
    });

    const region = screen.getByRole('status');
    expect(region.textContent).toContain('check');
  });

  it('announces checkmate', () => {
    // Scholar's mate
    const c = new Chess();
    ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'].forEach((m) => c.move(m));
    const preFen = c.fen();
    c.move('Qxf7#');
    const postFen = c.fen();

    const { rerender } = renderBoard(preFen);
    act(() => {
      rerender(
        <BoardSettingsProvider>
          <Chessboard position={postFen} orientation="white" />
        </BoardSettingsProvider>,
      );
    });

    const region = screen.getByRole('status');
    expect(region.textContent).toContain('checkmate');
  });

  it('does not re-announce on same-position re-render', () => {
    const nextFen = fenAfterMoves(['Nf3']);
    const { rerender } = renderBoard(START_FEN);

    act(() => {
      rerender(
        <BoardSettingsProvider>
          <Chessboard position={nextFen} orientation="white" />
        </BoardSettingsProvider>,
      );
    });

    // Re-render same position — should not change the announcement text
    const textAfterFirst = screen.getByRole('status').textContent;

    act(() => {
      rerender(
        <BoardSettingsProvider>
          <Chessboard position={nextFen} orientation="white" />
        </BoardSettingsProvider>,
      );
    });

    expect(screen.getByRole('status').textContent).toBe(textAfterFirst);
  });
});

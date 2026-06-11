import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Chessboard } from '@/components/board/chessboard';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { useSettingsStore } from '@/stores/settings-store';
import { animationsDisabled } from '@/lib/board/animations';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function renderBoard() {
  return render(
    <BoardSettingsProvider>
      <Chessboard position={START_FEN} orientation="white" />
    </BoardSettingsProvider>,
  );
}

describe('data-no-animations kill switch', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({ animations: true });
    });
  });

  it('attribute is absent while animations are enabled', () => {
    renderBoard();
    expect(document.querySelector('[data-no-animations]')).toBeNull();
    expect(animationsDisabled()).toBe(false);
  });

  it('disabling animations sets the attribute on the board container', () => {
    renderBoard();
    act(() => {
      useSettingsStore.setState({ animations: false });
    });

    const flagged = document.querySelector('[data-no-animations]');
    expect(flagged).not.toBeNull();
    // It must be an ancestor of the grid so the globals.css descendant
    // rules ([data-no-animations] [data-animating]) cover the board.
    expect(screen.getByRole('grid').closest('[data-no-animations]')).toBe(flagged);
    // …and the JS kill switch engages too.
    expect(animationsDisabled()).toBe(true);
  });

  it('re-enabling animations removes the attribute', () => {
    act(() => {
      useSettingsStore.setState({ animations: false });
    });
    renderBoard();
    expect(document.querySelector('[data-no-animations]')).not.toBeNull();

    act(() => {
      useSettingsStore.setState({ animations: true });
    });
    expect(document.querySelector('[data-no-animations]')).toBeNull();
    expect(animationsDisabled()).toBe(false);
  });
});

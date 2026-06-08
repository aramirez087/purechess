import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, render, screen } from '@testing-library/react';
import { useGameKeyboard } from '@/hooks/use-game-keyboard';
import { LiveAnnouncer } from '@/components/computer-game/live-announcer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fireKey(key: string, target: EventTarget = window) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function defaultOpts(overrides = {}) {
  return {
    isGameOver: false,
    isComputerThinking: false,
    currentPly: 4,
    totalPly: 8,
    onHint: vi.fn(),
    onTakeback: vi.fn(),
    onResign: vi.fn(),
    onFlip: vi.fn(),
    onNew: vi.fn(),
    onSeek: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// useGameKeyboard
// ---------------------------------------------------------------------------

describe('useGameKeyboard', () => {
  it('h triggers onHint', () => {
    const opts = defaultOpts();
    renderHook(() => useGameKeyboard(opts));
    act(() => fireKey('h'));
    expect(opts.onHint).toHaveBeenCalledTimes(1);
  });

  it('u triggers onTakeback', () => {
    const opts = defaultOpts();
    renderHook(() => useGameKeyboard(opts));
    act(() => fireKey('u'));
    expect(opts.onTakeback).toHaveBeenCalledTimes(1);
  });

  it('r triggers onResign', () => {
    const opts = defaultOpts();
    renderHook(() => useGameKeyboard(opts));
    act(() => fireKey('r'));
    expect(opts.onResign).toHaveBeenCalledTimes(1);
  });

  it('f triggers onFlip', () => {
    const opts = defaultOpts();
    renderHook(() => useGameKeyboard(opts));
    act(() => fireKey('f'));
    expect(opts.onFlip).toHaveBeenCalledTimes(1);
  });

  it('n triggers onNew', () => {
    const opts = defaultOpts();
    renderHook(() => useGameKeyboard(opts));
    act(() => fireKey('n'));
    expect(opts.onNew).toHaveBeenCalledTimes(1);
  });

  it('ArrowLeft calls onSeek with currentPly - 1', () => {
    const opts = defaultOpts({ currentPly: 4 });
    renderHook(() => useGameKeyboard(opts));
    act(() => fireKey('ArrowLeft'));
    expect(opts.onSeek).toHaveBeenCalledWith(3);
  });

  it('ArrowLeft clamps seek at 0', () => {
    const opts = defaultOpts({ currentPly: 0 });
    renderHook(() => useGameKeyboard(opts));
    act(() => fireKey('ArrowLeft'));
    expect(opts.onSeek).toHaveBeenCalledWith(0);
  });

  it('ArrowRight calls onSeek with currentPly + 1', () => {
    const opts = defaultOpts({ currentPly: 4, totalPly: 8 });
    renderHook(() => useGameKeyboard(opts));
    act(() => fireKey('ArrowRight'));
    expect(opts.onSeek).toHaveBeenCalledWith(5);
  });

  it('ArrowRight clamps seek at totalPly', () => {
    const opts = defaultOpts({ currentPly: 8, totalPly: 8 });
    renderHook(() => useGameKeyboard(opts));
    act(() => fireKey('ArrowRight'));
    expect(opts.onSeek).toHaveBeenCalledWith(8);
  });

  it('Home calls onSeek with 0', () => {
    const opts = defaultOpts();
    renderHook(() => useGameKeyboard(opts));
    act(() => fireKey('Home'));
    expect(opts.onSeek).toHaveBeenCalledWith(0);
  });

  it('End calls onSeek with totalPly', () => {
    const opts = defaultOpts({ totalPly: 8 });
    renderHook(() => useGameKeyboard(opts));
    act(() => fireKey('End'));
    expect(opts.onSeek).toHaveBeenCalledWith(8);
  });

  it('typing in an <input> is ignored', () => {
    const opts = defaultOpts();
    renderHook(() => useGameKeyboard(opts));
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => fireKey('h', input));
    expect(opts.onHint).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('typing in a <textarea> is ignored', () => {
    const opts = defaultOpts();
    renderHook(() => useGameKeyboard(opts));
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    act(() => fireKey('u', ta));
    expect(opts.onTakeback).not.toHaveBeenCalled();
    document.body.removeChild(ta);
  });

  it('u/h/r are ignored when isGameOver=true', () => {
    const opts = defaultOpts({ isGameOver: true });
    renderHook(() => useGameKeyboard(opts));
    act(() => { fireKey('u'); fireKey('h'); fireKey('r'); });
    expect(opts.onTakeback).not.toHaveBeenCalled();
    expect(opts.onHint).not.toHaveBeenCalled();
    expect(opts.onResign).not.toHaveBeenCalled();
  });

  it('u/h/r are ignored when isComputerThinking=true', () => {
    const opts = defaultOpts({ isComputerThinking: true });
    renderHook(() => useGameKeyboard(opts));
    act(() => { fireKey('u'); fireKey('h'); fireKey('r'); });
    expect(opts.onTakeback).not.toHaveBeenCalled();
    expect(opts.onHint).not.toHaveBeenCalled();
    expect(opts.onResign).not.toHaveBeenCalled();
  });

  it('f and n still fire when isGameOver=true', () => {
    const opts = defaultOpts({ isGameOver: true });
    renderHook(() => useGameKeyboard(opts));
    act(() => { fireKey('f'); fireKey('n'); });
    expect(opts.onFlip).toHaveBeenCalledTimes(1);
    expect(opts.onNew).toHaveBeenCalledTimes(1);
  });

  it('arrow keys ignored when a board square ([role=gridcell]) has focus', () => {
    const opts = defaultOpts();
    renderHook(() => useGameKeyboard(opts));

    // Build: grid > gridcell
    const grid = document.createElement('div');
    grid.setAttribute('role', 'grid');
    const cell = document.createElement('div');
    cell.setAttribute('role', 'gridcell');
    grid.appendChild(cell);
    document.body.appendChild(grid);

    act(() => fireKey('ArrowLeft', cell));
    expect(opts.onSeek).not.toHaveBeenCalled();
    document.body.removeChild(grid);
  });
});

// ---------------------------------------------------------------------------
// LiveAnnouncer
// ---------------------------------------------------------------------------

describe('LiveAnnouncer', () => {
  it('renders a visually-hidden role="status" region', () => {
    render(<LiveAnnouncer lastComputerMoveSan={null} gameResult={null} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('announces "Computer played Nf3." when lastComputerMoveSan changes', async () => {
    const { rerender } = render(
      <LiveAnnouncer lastComputerMoveSan={null} gameResult={null} />,
    );
    rerender(<LiveAnnouncer lastComputerMoveSan="Nf3" gameResult={null} />);
    expect(screen.getByRole('status')).toHaveTextContent('Computer played Nf3.');
  });

  it('announces move + result when both set together', () => {
    const { rerender } = render(
      <LiveAnnouncer lastComputerMoveSan={null} gameResult={null} />,
    );
    rerender(<LiveAnnouncer lastComputerMoveSan="Nxf7+" gameResult="You lost" />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Computer played Nxf7+. You lost.',
    );
  });

  it('announces "Game over. Draw." when only gameResult changes (no new computer move)', () => {
    const { rerender } = render(
      <LiveAnnouncer lastComputerMoveSan={null} gameResult={null} />,
    );
    rerender(<LiveAnnouncer lastComputerMoveSan={null} gameResult="Draw" />);
    expect(screen.getByRole('status')).toHaveTextContent('Game over. Draw.');
  });

  it('does not re-announce the same SAN twice', () => {
    const { rerender } = render(
      <LiveAnnouncer lastComputerMoveSan="Nf3" gameResult={null} />,
    );
    // First render with Nf3 sets prevSan
    rerender(<LiveAnnouncer lastComputerMoveSan="Nf3" gameResult={null} />);
    // Still shows last announcement, not a second one
    expect(screen.getByRole('status')).toHaveTextContent('Computer played Nf3.');
  });
});

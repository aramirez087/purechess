import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { Chessboard } from '@/components/board/chessboard';
import { useKeyboard } from '@/components/board/hooks/use-keyboard';
import type { Square } from '@purechess/shared';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function setup(onMove = vi.fn()) {
  render(
    <Chessboard
      position={START_FEN}
      orientation="white"
      onMove={onMove}
    />,
  );
  return { onMove };
}

describe('Chessboard keyboard interaction', () => {
  it('renders board with 64 squares', () => {
    setup();
    const cells = screen.getAllByRole('gridcell');
    expect(cells).toHaveLength(64);
  });

  it('Escape key does not throw', () => {
    setup();
    const board = screen.getByRole('grid');
    expect(() => {
      fireEvent.keyDown(board, { key: 'Escape' });
    }).not.toThrow();
  });

  it('ArrowRight key does not throw', () => {
    setup();
    const board = screen.getByRole('grid');
    expect(() => {
      fireEvent.keyDown(board, { key: 'ArrowRight' });
    }).not.toThrow();
  });

  it('ArrowUp key does not throw', () => {
    setup();
    const board = screen.getByRole('grid');
    expect(() => {
      fireEvent.keyDown(board, { key: 'ArrowUp' });
    }).not.toThrow();
  });

  it('has grid role and aria-label', () => {
    setup();
    const board = screen.getByRole('grid', { name: /chess board/i });
    expect(board).toBeTruthy();
  });

  it('squares have aria-label with square name', () => {
    setup();
    const e2 = screen.getAllByRole('gridcell').find(
      (el) => el.getAttribute('data-square') === 'e2',
    );
    expect(e2).toBeTruthy();
    expect(e2?.getAttribute('aria-label')).toMatch(/e2/);
  });
});

// --- useKeyboard hook unit tests ---

function makeHookOpts(overrides?: Partial<Parameters<typeof useKeyboard>[0]>) {
  const onMove = vi.fn();
  const legalDestinations = (sq: Square): Square[] =>
    sq === 'e2' ? ['e4' as Square] : [];
  const isOwnPiece = (sq: Square) => sq === 'e2' || sq === 'd2';
  return {
    orientation: 'white' as const,
    legalDestinations,
    onMove,
    isOwnPiece,
    ...overrides,
  };
}

function fireKey(handleKeyDown: (e: React.KeyboardEvent) => void, key: string) {
  const mockEvent = {
    key,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent;
  act(() => {
    handleKeyDown(mockEvent);
  });
  return mockEvent as unknown as { preventDefault: ReturnType<typeof vi.fn> };
}

describe('useKeyboard hook', () => {
  it('initial focusSquare is e2 when orientation is white', () => {
    const { result } = renderHook(() => useKeyboard(makeHookOpts()));
    expect(result.current.focusSquare).toBe('e2');
  });

  it('initial focusSquare is e7 when orientation is black', () => {
    const { result } = renderHook(() =>
      useKeyboard(makeHookOpts({ orientation: 'black' })),
    );
    expect(result.current.focusSquare).toBe('e7');
  });

  it('focusSquare resets to e7 when orientation changes to black', () => {
    const opts = makeHookOpts();
    const { result, rerender } = renderHook((o) => useKeyboard(o), {
      initialProps: opts,
    });
    expect(result.current.focusSquare).toBe('e2');
    rerender({ ...opts, orientation: 'black' as const });
    expect(result.current.focusSquare).toBe('e7');
  });

  it('Space calls preventDefault', () => {
    const { result } = renderHook(() => useKeyboard(makeHookOpts()));
    const mockEvent = {
      key: ' ',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;
    act(() => {
      result.current.handleKeyDown(mockEvent);
    });
    expect((mockEvent as unknown as { preventDefault: ReturnType<typeof vi.fn> }).preventDefault).toHaveBeenCalled();
  });

  it('Space selects own piece (same as Enter)', () => {
    const { result } = renderHook(() => useKeyboard(makeHookOpts()));
    expect(result.current.selectedSquare).toBeNull();
    fireKey(result.current.handleKeyDown, ' ');
    expect(result.current.selectedSquare).toBe('e2');
  });

  it('Space does not select a non-own piece', () => {
    const { result } = renderHook(() =>
      useKeyboard(makeHookOpts({ isOwnPiece: () => false })),
    );
    fireKey(result.current.handleKeyDown, ' ');
    expect(result.current.selectedSquare).toBeNull();
  });

  it('Escape clears selectedSquare', () => {
    const { result } = renderHook(() => useKeyboard(makeHookOpts()));
    fireKey(result.current.handleKeyDown, 'Enter');
    expect(result.current.selectedSquare).toBe('e2');
    fireKey(result.current.handleKeyDown, 'Escape');
    expect(result.current.selectedSquare).toBeNull();
  });

  it('Space confirms move when destination is focused after selection', () => {
    const onMove = vi.fn();
    const legalDestinations = (sq: Square): Square[] =>
      sq === 'e2' ? ['e4' as Square] : [];
    const isOwnPiece = (sq: Square) => sq === 'e2';
    const { result } = renderHook(() =>
      useKeyboard(makeHookOpts({ onMove, legalDestinations, isOwnPiece })),
    );
    fireKey(result.current.handleKeyDown, 'Enter');
    expect(result.current.selectedSquare).toBe('e2');
    // Move focus to e4 (2x ArrowUp)
    fireKey(result.current.handleKeyDown, 'ArrowUp');
    fireKey(result.current.handleKeyDown, 'ArrowUp');
    expect(result.current.focusSquare).toBe('e4');
    fireKey(result.current.handleKeyDown, ' ');
    expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' });
  });

  it('ArrowLeft clamps at file a', () => {
    const { result } = renderHook(() => useKeyboard(makeHookOpts()));
    for (let i = 0; i < 10; i++) {
      fireKey(result.current.handleKeyDown, 'ArrowLeft');
    }
    expect(result.current.focusSquare[0]).toBe('a');
  });
});

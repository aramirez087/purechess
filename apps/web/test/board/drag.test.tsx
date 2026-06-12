import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Chessboard } from '@/components/board/chessboard';
import type { Move } from '@purechess/shared';

// jsdom has no PointerEvent — without this, fireEvent falls back to a plain
// Event with no pointerType, touch silently behaves as mouse, and the snap
// tests would pass for the wrong reason.
class PointerEventPolyfill extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, params: PointerEventInit = {}) {
    super(type, params);
    this.pointerId = params.pointerId ?? 0;
    this.pointerType = params.pointerType ?? '';
  }
}
if (!window.PointerEvent) {
  window.PointerEvent = PointerEventPolyfill as unknown as typeof window.PointerEvent;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Server-style legal moves for e2 only — keeps dests deterministic (no lazy
// chess.js load race) and lets tests control the snap pool.
const E2_MOVES: Move[] = [
  { from: 'e2', to: 'e3' },
  { from: 'e2', to: 'e4' },
];

// Board rect: 800x800 at origin → square size 100. White orientation centers:
// e2 = (450, 650), e4 = (450, 450), e5 spans y [300, 400).
const RECT = {
  left: 0,
  top: 0,
  width: 800,
  height: 800,
  right: 800,
  bottom: 800,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect;

function setup() {
  const onMove = vi.fn();
  render(
    <Chessboard position={START_FEN} orientation="white" legalMoves={E2_MOVES} onMove={onMove} />,
  );
  const board = screen.getByTestId('chess-board');
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue(RECT);
  const grid = screen.getByRole('grid');
  const e2 = screen
    .getAllByRole('gridcell')
    .find((el) => el.getAttribute('data-square') === 'e2')!;
  return { onMove, grid, e2 };
}

function drag(
  e2: Element,
  grid: Element,
  pointerType: 'mouse' | 'touch',
  dropX: number,
  dropY: number,
) {
  const init = { pointerId: 1, pointerType };
  fireEvent.pointerDown(e2, { ...init, clientX: 450, clientY: 650 });
  // First move exceeds DRAG_THRESHOLD (4px) and starts the drag.
  fireEvent.pointerMove(grid, { ...init, clientX: dropX, clientY: dropY });
  fireEvent.pointerUp(grid, { ...init, clientX: dropX, clientY: dropY });
}

describe('Chessboard drag drop resolution', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('mouse drop at e4 center moves e2 to e4', () => {
    const { onMove, grid, e2 } = setup();
    drag(e2, grid, 'mouse', 450, 450);
    expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' });
  });

  it('touch drop inside e5 near e4 snaps to the legal e4', () => {
    const { onMove, grid, e2 } = setup();
    // (450, 390) is inside e5, 60px from e4's center — within the 2-square cap.
    drag(e2, grid, 'touch', 450, 390);
    expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' });
  });

  it('mouse drop at the same point does not snap (raw e5 forwarded)', () => {
    const { onMove, grid, e2 } = setup();
    drag(e2, grid, 'mouse', 450, 390);
    // Pre-existing behavior: illegal mouse drops are forwarded for the
    // server/game layer to reject.
    expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e5' });
  });

  it('touch drop just outside the board clamps to the edge square', () => {
    const { onMove, grid, e2 } = setup();
    // 0.4 squares left of the a-file at rank 5; beyond snap range of e3/e4.
    drag(e2, grid, 'touch', -40, 350);
    expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'a5' });
  });

  it('touch drop beyond the half-square margin cancels the drag', () => {
    const { onMove, grid, e2 } = setup();
    drag(e2, grid, 'touch', -60, 350);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('touch drop back on the origin square cancels (no snap)', () => {
    const { onMove, grid, e2 } = setup();
    fireEvent.pointerDown(e2, { pointerId: 1, pointerType: 'touch', clientX: 450, clientY: 650 });
    fireEvent.pointerMove(grid, { pointerId: 1, pointerType: 'touch', clientX: 450, clientY: 450 });
    // Return to e2 before release.
    fireEvent.pointerMove(grid, { pointerId: 1, pointerType: 'touch', clientX: 455, clientY: 655 });
    fireEvent.pointerUp(grid, { pointerId: 1, pointerType: 'touch', clientX: 455, clientY: 655 });
    expect(onMove).not.toHaveBeenCalled();
  });
});

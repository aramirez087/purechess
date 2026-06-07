import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Chessboard } from '@/components/board/chessboard';

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

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorBoard } from '@/components/editor/editor-board';
import { PiecePalette } from '@/components/editor/piece-palette';
import { STARTING_EDITOR_STATE, type EditorState } from '@/lib/board/editor-state';

function square(name: string): HTMLElement {
  return screen
    .getAllByRole('gridcell')
    .find((el) => el.getAttribute('data-square') === name)!;
}

function makeDataTransfer() {
  const store: Record<string, string> = {};
  return {
    setData: (k: string, v: string) => {
      store[k] = v;
    },
    getData: (k: string) => store[k] ?? '',
    dropEffect: 'none',
    effectAllowed: 'all',
  };
}

describe('EditorBoard', () => {
  it('right-click on an occupied square removes the piece', () => {
    const onChange = vi.fn();
    render(<EditorBoard state={STARTING_EDITOR_STATE} onChange={onChange} />);

    fireEvent.contextMenu(square('e1'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as EditorState;
    expect(next.board.has('e1')).toBe(false);
    expect(next.board.has('d1')).toBe(true); // other pieces untouched
  });

  it('forwards a plain click to onSquareClick (palette placement path)', () => {
    const onSquareClick = vi.fn();
    render(
      <EditorBoard
        state={STARTING_EDITOR_STATE}
        onChange={vi.fn()}
        onSquareClick={onSquareClick}
      />,
    );

    fireEvent.click(square('e4'));

    expect(onSquareClick).toHaveBeenCalledWith('e4');
  });

  it('dragging a piece moves it to the drop target', () => {
    const onChange = vi.fn();
    render(<EditorBoard state={STARTING_EDITOR_STATE} onChange={onChange} />);
    const dt = makeDataTransfer();

    fireEvent.dragStart(square('e2'), { dataTransfer: dt });
    fireEvent.dragOver(square('e4'), { dataTransfer: dt });
    fireEvent.drop(square('e4'), { dataTransfer: dt });

    const next = onChange.mock.calls.at(-1)![0] as EditorState;
    expect(next.board.has('e2')).toBe(false);
    expect(next.board.get('e4')).toEqual({ type: 'p', color: 'w' });
  });
});

describe('PiecePalette', () => {
  it('selecting a chip reports the piece, clicking it again deselects', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<PiecePalette active={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /white q/i }));
    expect(onSelect).toHaveBeenCalledWith({ type: 'q', color: 'w' });

    rerender(<PiecePalette active={{ type: 'q', color: 'w' }} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /white q/i }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('selecting trash reports the trash sentinel', () => {
    const onSelect = vi.fn();
    render(<PiecePalette active={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /trash/i }));
    expect(onSelect).toHaveBeenCalledWith('trash');
  });
});

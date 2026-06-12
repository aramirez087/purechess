import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useMoveInput } from '@/components/board/hooks/use-move-input';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const PROMO = '7k/4P3/8/8/8/8/8/7K w - - 0 1';

function keyEvent(key: string, shiftKey = false): React.KeyboardEvent {
  return {
    key,
    shiftKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.KeyboardEvent;
}

async function openHook(fen = START, enabled = true) {
  const onMove = vi.fn();
  const utils = renderHook(() => useMoveInput({ fen, onMove, enabled }));
  act(() => {
    utils.result.current.openWith();
  });
  await waitFor(() => expect(utils.result.current.matches.length).toBeGreaterThan(0));
  return { ...utils, onMove };
}

describe('useMoveInput', () => {
  it('openWith is a no-op when disabled', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useMoveInput({ fen: START, onMove, enabled: false }));
    act(() => {
      result.current.openWith('e');
    });
    expect(result.current.open).toBe(false);
  });

  it('auto-confirms a unique full SAN match', async () => {
    const { result, onMove } = await openHook();
    act(() => {
      result.current.setQuery('e4');
    });
    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
    expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4', promotion: undefined });
    expect(result.current.open).toBe(false);
  });

  it('auto-confirms a unique full UCI match', async () => {
    const { result, onMove } = await openHook();
    act(() => {
      result.current.setQuery('g1f3');
    });
    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
    expect(onMove).toHaveBeenCalledWith({ from: 'g1', to: 'f3', promotion: undefined });
  });

  it('does NOT auto-confirm a unique 2-char partial', async () => {
    const { result, onMove } = await openHook();
    act(() => {
      result.current.setQuery('Nf'); // only Nf3 is legal from the start position
    });
    await waitFor(() => expect(result.current.matches).toHaveLength(1));
    expect(onMove).not.toHaveBeenCalled();
    expect(result.current.open).toBe(true);
  });

  it('ArrowDown/ArrowUp cycle selectedIdx with wrapping', async () => {
    const { result } = await openHook();
    expect(result.current.matches).toHaveLength(20);
    expect(result.current.selectedIdx).toBe(0);
    act(() => {
      result.current.handleKeyDown(keyEvent('ArrowDown'));
    });
    expect(result.current.selectedIdx).toBe(1);
    act(() => {
      result.current.handleKeyDown(keyEvent('ArrowUp'));
    });
    act(() => {
      result.current.handleKeyDown(keyEvent('ArrowUp'));
    });
    expect(result.current.selectedIdx).toBe(19); // wrapped below 0
    act(() => {
      result.current.handleKeyDown(keyEvent('ArrowDown'));
    });
    expect(result.current.selectedIdx).toBe(0); // wrapped past the end
  });

  it('Tab cycles like ArrowDown, Shift+Tab backwards', async () => {
    const { result } = await openHook();
    act(() => {
      result.current.handleKeyDown(keyEvent('Tab'));
    });
    expect(result.current.selectedIdx).toBe(1);
    act(() => {
      result.current.handleKeyDown(keyEvent('Tab', true));
    });
    expect(result.current.selectedIdx).toBe(0);
  });

  it('Enter confirms the selected match', async () => {
    const { result, onMove } = await openHook();
    act(() => {
      result.current.setQuery('N'); // [Na3, Nc3, Nf3, Nh3]
    });
    await waitFor(() => expect(result.current.matches).toHaveLength(4));
    act(() => {
      result.current.handleKeyDown(keyEvent('ArrowDown'));
    });
    act(() => {
      result.current.handleKeyDown(keyEvent('Enter'));
    });
    expect(onMove).toHaveBeenCalledWith({ from: 'b1', to: 'c3', promotion: undefined });
    expect(result.current.open).toBe(false);
  });

  it('Escape closes without a move and resets the query', async () => {
    const { result, onMove } = await openHook();
    act(() => {
      result.current.setQuery('e');
    });
    act(() => {
      result.current.handleKeyDown(keyEvent('Escape'));
    });
    expect(result.current.open).toBe(false);
    expect(result.current.query).toBe('');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('bare promotion UCI shows all four options; Enter defaults to queen', async () => {
    const { result, onMove } = await openHook(PROMO);
    act(() => {
      result.current.setQuery('e7e8');
    });
    await waitFor(() => expect(result.current.matches).toHaveLength(4));
    expect(onMove).not.toHaveBeenCalled(); // 4 matches → no auto-confirm
    act(() => {
      result.current.handleKeyDown(keyEvent('Enter'));
    });
    expect(onMove).toHaveBeenCalledWith({ from: 'e7', to: 'e8', promotion: 'q' });
  });

  it('arrow navigation overrides the queen default on Enter', async () => {
    const { result, onMove } = await openHook(PROMO);
    act(() => {
      result.current.setQuery('e7e8');
    });
    await waitFor(() => expect(result.current.matches).toHaveLength(4));
    // Sorted by SAN: e8=B, e8=N, e8=Q, e8=R — ArrowDown lands on the knight.
    act(() => {
      result.current.handleKeyDown(keyEvent('ArrowDown'));
    });
    act(() => {
      result.current.handleKeyDown(keyEvent('Enter'));
    });
    expect(onMove).toHaveBeenCalledWith({ from: 'e7', to: 'e8', promotion: 'n' });
  });
});

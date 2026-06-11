import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameKeyboard } from '@/hooks/use-game-keyboard';

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('useGameKeyboard draw binding', () => {
  it("'d' triggers onDraw while the game is live", () => {
    const onDraw = vi.fn();
    renderHook(() =>
      useGameKeyboard({
        isGameOver: false,
        isComputerThinking: false,
        currentPly: 0,
        totalPly: 0,
        onDraw,
      }),
    );

    press('d');
    expect(onDraw).toHaveBeenCalledTimes(1);
  });

  it("'d' is inert once the game is over", () => {
    const onDraw = vi.fn();
    renderHook(() =>
      useGameKeyboard({
        isGameOver: true,
        isComputerThinking: false,
        currentPly: 0,
        totalPly: 0,
        onDraw,
      }),
    );

    press('d');
    expect(onDraw).not.toHaveBeenCalled();
  });
});

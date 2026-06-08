import { useEffect, useLayoutEffect, useRef } from 'react';

export interface UseGameKeyboardOptions {
  isGameOver: boolean;
  isComputerThinking: boolean;
  currentPly: number;
  totalPly: number;
  onHint?: () => void;
  onTakeback?: () => void;
  onResign?: () => void;
  onFlip?: () => void;
  onNew?: () => void;
  onSeek?: (ply: number) => void;
}

export function useGameKeyboard(opts: UseGameKeyboardOptions): void {
  const optsRef = useRef(opts);
  useLayoutEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const t = e.target instanceof Element ? e.target : null;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) return;

      const o = optsRef.current;
      const isArrow = e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End';

      // Let the board handle its own arrow navigation when a board square has focus
      if (isArrow && t?.closest('[role="grid"]')) return;

      switch (e.key) {
        case 'h':
          if (!o.isGameOver && !o.isComputerThinking) o.onHint?.();
          break;
        case 'u':
          if (!o.isGameOver && !o.isComputerThinking) o.onTakeback?.();
          break;
        case 'r':
          if (!o.isGameOver && !o.isComputerThinking) o.onResign?.();
          break;
        case 'f':
          o.onFlip?.();
          break;
        case 'n':
          o.onNew?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          o.onSeek?.(Math.max(0, o.currentPly - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          o.onSeek?.(Math.min(o.totalPly, o.currentPly + 1));
          break;
        case 'Home':
          e.preventDefault();
          o.onSeek?.(0);
          break;
        case 'End':
          e.preventDefault();
          o.onSeek?.(o.totalPly);
          break;
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []); // stable via optsRef
}

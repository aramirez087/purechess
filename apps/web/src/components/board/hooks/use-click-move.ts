'use client';

import { useCallback, useState } from 'react';
import type { Square, MoveIntent } from '@purchess/shared';

type ClickState = { phase: 'idle' } | { phase: 'selected'; from: Square };

interface UseClickMoveOptions {
  legalDestinations: (square: Square) => Square[];
  onMove: (move: MoveIntent) => void;
  isOwnPiece: (square: Square) => boolean;
}

export function useClickMove({ legalDestinations, onMove, isOwnPiece }: UseClickMoveOptions) {
  const [state, setState] = useState<ClickState>({ phase: 'idle' });

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (state.phase === 'idle') {
        if (isOwnPiece(square)) {
          setState({ phase: 'selected', from: square });
        }
        return;
      }

      if (state.phase === 'selected') {
        const { from } = state;

        if (square === from) {
          setState({ phase: 'idle' });
          return;
        }

        if (isOwnPiece(square)) {
          setState({ phase: 'selected', from: square });
          return;
        }

        const dests = legalDestinations(from);
        if (dests.includes(square)) {
          onMove({ from, to: square });
          setState({ phase: 'idle' });
        } else {
          setState({ phase: 'idle' });
        }
      }
    },
    [state, legalDestinations, onMove, isOwnPiece],
  );

  const deselect = useCallback(() => {
    setState({ phase: 'idle' });
  }, []);

  return {
    selectedSquare: state.phase === 'selected' ? state.from : null,
    handleSquareClick,
    deselect,
  };
}

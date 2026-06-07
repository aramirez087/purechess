'use client';

import { useCallback, useState } from 'react';
import type { Square, MoveIntent } from '@purchess/shared';
import type { Orientation } from '@/lib/board/types';

function squareToCoords(sq: Square): [number, number] {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1], 10) - 1;
  return [file, rank];
}

function coordsToSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return (String.fromCharCode(97 + file) + (rank + 1)) as Square;
}

interface UseKeyboardOptions {
  orientation: Orientation;
  legalDestinations: (square: Square) => Square[];
  onMove: (move: MoveIntent) => void;
  isOwnPiece: (square: Square) => boolean;
}

export function useKeyboard({ orientation, legalDestinations, onMove, isOwnPiece }: UseKeyboardOptions) {
  const [focusSquare, setFocusSquare] = useState<Square>('e2');
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const [file, rank] = squareToCoords(focusSquare);

      const rankDir = orientation === 'white' ? 1 : -1;
      const fileDir = orientation === 'white' ? 1 : -1;

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault();
          const next = coordsToSquare(file, rank + rankDir);
          if (next) setFocusSquare(next);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const next = coordsToSquare(file, rank - rankDir);
          if (next) setFocusSquare(next);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const next = coordsToSquare(file + fileDir, rank);
          if (next) setFocusSquare(next);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const next = coordsToSquare(file - fileDir, rank);
          if (next) setFocusSquare(next);
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (!selectedSquare) {
            if (isOwnPiece(focusSquare)) {
              setSelectedSquare(focusSquare);
            }
          } else {
            const dests = legalDestinations(selectedSquare);
            if (dests.includes(focusSquare)) {
              onMove({ from: selectedSquare, to: focusSquare });
              setSelectedSquare(null);
            } else if (isOwnPiece(focusSquare)) {
              setSelectedSquare(focusSquare);
            } else {
              setSelectedSquare(null);
            }
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setSelectedSquare(null);
          break;
        }
      }
    },
    [focusSquare, selectedSquare, orientation, legalDestinations, onMove, isOwnPiece],
  );

  return { focusSquare, selectedSquare, handleKeyDown };
}

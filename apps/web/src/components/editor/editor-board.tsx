'use client';

import { useRef, useState } from 'react';
import type { Square } from '@purechess/shared';
import { Piece } from '@/components/board/piece';
import {
  type EditorState,
  SQUARES,
  isLightSquare,
  movePiece,
  removeSquare,
} from '@/lib/board/editor-state';
import { cn } from '@/lib/utils';

interface EditorBoardProps {
  state: EditorState;
  onChange: (next: EditorState) => void;
  flipped?: boolean;
  /** Click on a square — the page uses this to place/remove the active palette piece. */
  onSquareClick?: (square: Square) => void;
}

const DND_KEY = 'application/x-purechess-square';

export function EditorBoard({ state, onChange, flipped, onSquareClick }: EditorBoardProps) {
  const [dragOver, setDragOver] = useState<Square | null>(null);
  // Tracks whether the in-flight drag ended on a board square; if not, the
  // piece was dragged off the board and should be removed (HTML5 dragEnd's
  // dropEffect is unreliable across browsers, so we track it ourselves).
  const droppedOnBoard = useRef(false);

  const order = flipped ? [...SQUARES].reverse() : SQUARES;

  function handleDrop(e: React.DragEvent, to: Square) {
    e.preventDefault();
    droppedOnBoard.current = true;
    setDragOver(null);
    const from = e.dataTransfer.getData(DND_KEY) as Square;
    if (from && from !== to) onChange(movePiece(state, from, to));
  }

  return (
    <div
      data-testid="editor-board"
      className="grid aspect-square w-full select-none grid-cols-8 grid-rows-8 overflow-hidden rounded-[4px]"
      role="grid"
      aria-label="Position editor board"
    >
      {Array.from({ length: 8 }, (_, rowIdx) => (
        <div key={`row-${rowIdx}`} role="row" style={{ display: 'contents' }}>
          {order.slice(rowIdx * 8, rowIdx * 8 + 8).map((square) => {
            const piece = state.board.get(square);
            const light = isLightSquare(square);
            return (
              <div
                key={square}
                data-square={square}
                role="gridcell"
                aria-label={`${square}${piece ? ` ${piece.color}${piece.type}` : ' empty'}`}
                draggable={Boolean(piece)}
                className={cn(
                  'relative flex h-full w-full items-center justify-center',
                  light ? 'bg-[hsl(var(--board-sq-light))]' : 'bg-[hsl(var(--board-sq-dark))]',
                  piece ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                  dragOver === square && 'ring-2 ring-inset ring-brass',
                )}
                onClick={() => onSquareClick?.(square)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onChange(removeSquare(state, square));
                }}
                onDragStart={(e) => {
                  if (!piece) return;
                  droppedOnBoard.current = false;
                  e.dataTransfer.setData(DND_KEY, square);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOver !== square) setDragOver(square);
                }}
                onDragLeave={() => setDragOver((s) => (s === square ? null : s))}
                onDrop={(e) => handleDrop(e, square)}
                onDragEnd={() => {
                  // Dropped outside any board square → remove the piece.
                  if (!droppedOnBoard.current) onChange(removeSquare(state, square));
                  setDragOver(null);
                }}
              >
                {piece && (
                  <div className="pointer-events-none h-[86%] w-[86%]">
                    <Piece type={piece.type} color={piece.color} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

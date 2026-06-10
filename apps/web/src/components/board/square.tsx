'use client';

import { memo } from 'react';
import type { Square as SquareType, Piece } from '@purechess/shared';
import { cn } from '@/lib/utils';
import { Piece as PieceComponent } from './piece';

interface SquareProps {
  square: SquareType;
  piece: Piece | null;
  isLight: boolean;
  isSelected: boolean;
  isLegalMove: boolean;
  isLegalCapture: boolean;
  isLastMoveFrom: boolean;
  isLastMoveTo: boolean;
  isInCheck: boolean;
  isPremoveFrom: boolean;
  isPreMoveTo: boolean;
  isKeyboardFocus: boolean;
  isDragSource: boolean;
  ghostPiece?: Piece;
  onPointerDown?: (e: React.PointerEvent, square: SquareType) => void;
  onClick?: (square: SquareType) => void;
  ariaLabel: string;
}

export const Square = memo(function Square({
  square,
  piece,
  isLight,
  isSelected,
  isLegalMove,
  isLegalCapture,
  isLastMoveFrom,
  isLastMoveTo,
  isInCheck,
  isPremoveFrom,
  isPreMoveTo,
  isKeyboardFocus,
  isDragSource,
  ghostPiece,
  onPointerDown,
  onClick,
  ariaLabel,
}: SquareProps) {
  return (
    <div
      data-square={square}
      aria-label={ariaLabel}
      role="gridcell"
      className={cn(
        'relative flex items-center justify-center cursor-pointer',
        'w-[var(--board-sq-size)] h-[var(--board-sq-size)]',
        isLight ? 'bg-[hsl(var(--board-sq-light))]' : 'bg-[hsl(var(--board-sq-dark))]',
        isLastMoveFrom && 'sq-last-from',
        isLastMoveTo && 'sq-last-to',
        isSelected && 'sq-selected',
        isPremoveFrom && 'sq-premove-from',
        isPreMoveTo && 'sq-premove-to',
        isKeyboardFocus && 'ring-2 ring-inset ring-[hsl(var(--brass))]',
      )}
      onPointerDown={onPointerDown ? (e) => onPointerDown(e, square) : undefined}
      onClick={onClick ? () => onClick(square) : undefined}
    >
      {(isLastMoveFrom || isLastMoveTo) && !isSelected && (
        <div
          aria-hidden
          className="absolute inset-0 z-[5] pointer-events-none"
          style={{ backgroundColor: `hsl(var(--board-highlight-last))` }}
        />
      )}
      {isSelected && (
        <div
          aria-hidden
          className="absolute inset-0 z-[5] pointer-events-none"
          style={{ backgroundColor: `hsl(var(--board-highlight-selected))` }}
        />
      )}
      {(isPremoveFrom || isPreMoveTo) && (
        <div
          aria-hidden
          className="absolute inset-0 z-[5] pointer-events-none"
          style={{ backgroundColor: `hsl(var(--board-highlight-premove))` }}
        />
      )}
      {isInCheck && (
        <div
          aria-hidden
          className="sq-check absolute inset-0 z-[5] pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 50%, hsl(var(--board-highlight-check) / 0.65) 0%, hsl(var(--board-highlight-check) / 0.35) 55%, transparent 78%)`,
            animation: 'check-pulse 1s ease-in-out 3',
          }}
        />
      )}
      {isLegalMove && !isLegalCapture && (
        <div
          className="absolute rounded-full pointer-events-none z-10"
          style={{
            width: '30%',
            height: '30%',
            backgroundColor: `hsl(var(--board-legal-dot))`,
          }}
        />
      )}
      {isLegalCapture && (
        <div
          className="absolute pointer-events-none z-10 rounded-full"
          style={{
            inset: '3%',
            border: `calc(var(--board-sq-size) * 0.085) solid hsl(var(--board-legal-ring))`,
          }}
        />
      )}
      {piece && !isDragSource && (
        <div className="absolute inset-0 z-20 p-[4%]" data-piece-on={square}>
          <PieceComponent type={piece.type} color={piece.color} />
        </div>
      )}
      {isDragSource && piece && (
        <div className="absolute inset-0 z-20 p-[4%] opacity-30" data-piece-on={square}>
          <PieceComponent type={piece.type} color={piece.color} />
        </div>
      )}
      {ghostPiece && (
        <div className="absolute inset-0 z-20 p-[4%]">
          <PieceComponent type={ghostPiece.type} color={ghostPiece.color} ghost />
        </div>
      )}
    </div>
  );
});

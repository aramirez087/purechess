'use client';

import { memo } from 'react';
import type { Square as SquareType, Piece } from '@purechess/shared';
import { cn } from '@/lib/utils';
import { MoveGlyphBadge, type MoveGlyphClass } from '@/lib/board/move-glyph';
import { Piece as PieceComponent } from './piece';

interface SquareProps {
  square: SquareType;
  piece: Piece | null;
  /** Suppress the static piece render (it is being animated by the AnimationLayer). */
  hidePiece?: boolean;
  isLight: boolean;
  isSelected: boolean;
  isLegalMove: boolean;
  isLegalCapture: boolean;
  /** The hint marks a premove target (opponent's turn) — rendered softer than a confirmed-legal hint. */
  isPremoveDest?: boolean;
  isLastMoveFrom: boolean;
  isLastMoveTo: boolean;
  isInCheck: boolean;
  isPremoveFrom: boolean;
  isPreMoveTo: boolean;
  isKeyboardFocus: boolean;
  isDragSource: boolean;
  /** A drag is in flight and the pointer is over this square. */
  isDragOver?: boolean;
  /** Affordance computed by the board: own piece = grab, legal destination = pointer. */
  cursor?: 'grab' | 'pointer' | 'default';
  ghostPiece?: Piece;
  /** Review move-classification badge (chess.com-style corner glyph). */
  glyph?: MoveGlyphClass;
  onPointerDown?: (e: React.PointerEvent, square: SquareType) => void;
  onClick?: (square: SquareType) => void;
  ariaLabel: string;
}

export const Square = memo(function Square({
  square,
  piece,
  hidePiece,
  isLight,
  isSelected,
  isLegalMove,
  isLegalCapture,
  isPremoveDest,
  isLastMoveFrom,
  isLastMoveTo,
  isInCheck,
  isPremoveFrom,
  isPreMoveTo,
  isKeyboardFocus,
  isDragSource,
  isDragOver,
  cursor = 'default',
  ghostPiece,
  glyph,
  onPointerDown,
  onClick,
  ariaLabel,
}: SquareProps) {
  return (
    <div
      data-square={square}
      aria-label={ariaLabel}
      aria-selected={isSelected || isKeyboardFocus ? true : undefined}
      role="gridcell"
      className={cn(
        'relative flex items-center justify-center',
        cursor === 'grab'
          ? 'cursor-grab'
          : cursor === 'pointer'
            ? 'cursor-pointer'
            : 'cursor-default',
        // Pure-CSS sizing (grid tracks own the geometry) so the SSR'd board
        // paints full-size before any JS runs. --board-sq-size still exists
        // for the drag ghost / coordinates / legal-ring calc.
        'h-full w-full',
        isLight ? 'bg-[hsl(var(--board-sq-light))]' : 'bg-[hsl(var(--board-sq-dark))]',
        isLastMoveFrom && 'sq-last-from',
        isLastMoveTo && 'sq-last-to',
        isSelected && 'sq-selected',
        isPremoveFrom && 'sq-premove-from',
        isPreMoveTo && 'sq-premove-to',
      )}
      onPointerDown={onPointerDown ? (e) => onPointerDown(e, square) : undefined}
      onClick={onClick ? () => onClick(square) : undefined}
    >
      {(isLastMoveFrom || isLastMoveTo) && !isSelected && (
        <div
          aria-hidden
          className="absolute inset-0 z-[5] pointer-events-none"
          style={{
            backgroundColor: isLight
              ? `hsl(var(--board-highlight-last-light))`
              : `hsl(var(--board-highlight-last-dark))`,
          }}
        />
      )}
      {isSelected && (
        <div
          aria-hidden
          className="absolute inset-0 z-[5] pointer-events-none"
          style={{
            backgroundColor: isLight
              ? `hsl(var(--board-highlight-selected-light))`
              : `hsl(var(--board-highlight-selected-dark))`,
            // Inset brass hairline so selection reads "held" vs the last-move wash.
            boxShadow: 'inset 0 0 0 2px hsl(41 85% 60% / 0.85)',
          }}
        />
      )}
      {(isPremoveFrom || isPreMoveTo) && (
        <div
          aria-hidden
          className="absolute inset-0 z-[5] pointer-events-none"
          style={{ backgroundColor: `hsl(var(--board-highlight-premove))` }}
        />
      )}
      {isDragOver && (
        <div
          aria-hidden
          className="absolute inset-0 z-[6] pointer-events-none ring-inset ring-[3px] ring-[hsl(var(--brass)/0.75)]"
        />
      )}
      {isKeyboardFocus && (
        <div
          aria-hidden
          className="absolute inset-0 z-[6] pointer-events-none"
          // First inset shadow paints ON TOP: a dark edge hairline, then a
          // bright gold band under it. The light band carries 3:1+ on dark
          // squares, the dark hairline carries it on light squares — the pair
          // clears the focus-indicator floor on every theme without per-theme
          // overrides. Rendered as a z-lifted child (like every other
          // indicator) so the surface overlay can't wash it out.
          style={{
            boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.6), inset 0 0 0 5px hsl(42 85% 76%)',
          }}
        />
      )}
      {isInCheck && (
        <div
          aria-hidden
          className="sq-check absolute inset-0 z-[5] pointer-events-none"
          // Light-hot core (lichess-style): keeps the check readable as a
          // luminance event, not a hue-only red wash — red-on-warm-brown
          // (walnut) and red-on-green (classic) are both CVD-hostile pairs.
          style={{
            background: `radial-gradient(circle at 50% 50%, hsl(0 90% 96% / 0.85) 0%, hsl(var(--board-highlight-check) / 0.65) 30%, hsl(var(--board-highlight-check) / 0.35) 60%, transparent 80%)`,
            animation: 'check-pulse 1.4s ease-in-out 2',
          }}
        />
      )}
      {isLegalMove && !isLegalCapture && (
        <div
          className="sq-legal-dot absolute rounded-full pointer-events-none z-10"
          style={{
            width: '30%',
            height: '30%',
            backgroundColor: isLight
              ? `hsl(var(--board-legal-dot-light))`
              : `hsl(var(--board-legal-dot-dark))`,
            opacity: isPremoveDest ? 0.7 : undefined,
          }}
        />
      )}
      {isLegalCapture && (
        <div
          className="sq-legal-ring absolute pointer-events-none z-10 rounded-full"
          style={{
            inset: '3%',
            border: `calc(var(--board-sq-size) * 0.085) solid ${
              isLight ? 'hsl(var(--board-legal-ring-light))' : 'hsl(var(--board-legal-ring-dark))'
            }`,
            opacity: isPremoveDest ? 0.7 : undefined,
          }}
        />
      )}
      {piece && !isDragSource && !hidePiece && (
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
      {glyph && <MoveGlyphBadge moveClass={glyph} />}
    </div>
  );
});

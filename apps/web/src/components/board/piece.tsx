'use client';

import { memo } from 'react';
import type { PieceType, Color } from '@purechess/shared';
import { getPieceSvg } from '@/lib/board/piece-svgs';
import { cn } from '@/lib/utils';

interface PieceProps {
  type: PieceType;
  color: Color;
  ghost?: boolean;
  className?: string;
}

export const Piece = memo(function Piece({ type, color, ghost, className }: PieceProps) {
  const SvgComponent = getPieceSvg(type, color);
  return (
    <SvgComponent
      className={cn(
        'block h-full w-full select-none pointer-events-none',
        // Two-layer shadow: tight contact dark + soft ambient falloff, so the
        // piece reads as sitting ON the board instead of floating over it.
        color === 'b'
          ? '[filter:drop-shadow(0_1px_1px_rgba(8,7,4,0.5))_drop-shadow(0_4px_5px_rgba(8,7,4,0.24))]'
          : '[filter:drop-shadow(0_1px_1px_rgba(8,7,4,0.38))_drop-shadow(0_4px_5px_rgba(8,7,4,0.18))]',
        ghost && 'opacity-40',
        className,
      )}
    />
  );
});

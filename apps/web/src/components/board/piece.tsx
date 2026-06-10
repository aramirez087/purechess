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
        color === 'b'
          ? 'drop-shadow-[0_2px_2px_rgba(0,0,0,0.38)]'
          : 'drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]',
        ghost && 'opacity-40',
        className,
      )}
    />
  );
});

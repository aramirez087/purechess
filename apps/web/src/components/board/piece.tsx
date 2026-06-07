'use client';

import { memo } from 'react';
import type { PieceType, Color } from '@purchess/shared';
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
        'w-full h-full select-none pointer-events-none',
        ghost && 'opacity-40',
        className,
      )}
    />
  );
});

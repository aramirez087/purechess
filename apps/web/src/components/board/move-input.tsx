'use client';

import type { PieceType, Color } from '@purchess/shared';
import { getPieceSvg } from '@/lib/board/piece-svgs';

const PROMOTION_PIECES: PieceType[] = ['q', 'r', 'b', 'n'];

interface MoveInputProps {
  color: Color;
  onSelect: (piece: PieceType) => void;
  onCancel: () => void;
}

export function MoveInput({ color, onSelect, onCancel }: MoveInputProps) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="flex gap-1 bg-background border border-border rounded p-2 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {PROMOTION_PIECES.map((type) => {
          const SvgComponent = getPieceSvg(type, color);
          return (
            <button
              key={type}
              className="w-12 h-12 p-1 rounded hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSelect(type)}
              aria-label={`Promote to ${type}`}
            >
              <SvgComponent className="w-full h-full" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

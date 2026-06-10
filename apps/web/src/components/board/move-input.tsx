'use client';

import type { PieceType, Color } from '@purechess/shared';
import { getPieceSvg } from '@/lib/board/piece-svgs';

const PROMOTION_PIECES: PieceType[] = ['q', 'r', 'b', 'n'];

const PIECE_NAMES: Record<string, string> = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
};

interface MoveInputProps {
  color: Color;
  onSelect: (piece: PieceType) => void;
  onCancel: () => void;
}

export function MoveInput({ color, onSelect, onCancel }: MoveInputProps) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-[#0b0d0b]/60 backdrop-blur-[3px]"
      onClick={onCancel}
      role="dialog"
      aria-label="Choose promotion piece"
    >
      <div
        className="flex flex-col items-center gap-2.5 rounded-[14px] border border-[#2b332c]/90 bg-gradient-to-b from-[#171b13] to-[#0d100b] px-4 pb-4 pt-3 shadow-[0_24px_70px_-18px_rgba(0,0,0,0.8),0_0_60px_-24px_rgba(214,181,99,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9da79c]">
          Promote to
        </p>
        <div className="flex gap-1.5">
          {PROMOTION_PIECES.map((type) => {
            const SvgComponent = getPieceSvg(type, color);
            return (
              <button
                key={type}
                className="h-16 w-16 rounded-[10px] border border-transparent bg-[#0b0d0b]/45 p-1.5 transition-all hover:-translate-y-0.5 hover:border-[#d6b563]/55 hover:bg-[#d6b563]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563]"
                onClick={() => onSelect(type)}
                aria-label={`Promote to ${PIECE_NAMES[type]}`}
              >
                <SvgComponent className="h-full w-full drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)]" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

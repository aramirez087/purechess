'use client';

import { getPieceSvg } from '@/lib/board/piece-svgs';
import { cn } from '@/lib/utils';
import type { PieceType, Color } from '@purechess/shared';

export interface CapturedMaterialProps {
  /** Captured pieces to display (already the color passed in `color`). */
  pieces: PieceType[];
  /** Signed advantage for the side that captured these pieces; shows `+N` when > 0. */
  advantage: number;
  /** Color of the captured glyphs to draw. */
  color: Color;
  className?: string;
}

export function CapturedMaterial({ pieces, advantage, color, className }: CapturedMaterialProps) {
  if (pieces.length === 0 && advantage <= 0) return null;

  // Black glyphs vanish on the near-black strip, so give them a faint light halo;
  // light glyphs get a subtle dark shadow. Tuned further at design QC.
  const glow =
    color === 'b'
      ? 'drop-shadow-[0_0_1px_rgba(255,255,255,0.55)]'
      : 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]';

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {pieces.length > 0 && (
        <div className="flex items-center">
          {pieces.map((type, i) => {
            const Svg = getPieceSvg(type, color);
            return <Svg key={`${type}-${i}`} className={cn('h-4 w-4', glow, i > 0 && '-ml-2')} />;
          })}
        </div>
      )}
      {advantage > 0 && (
        <span className="text-xs font-medium tabular-nums text-[#9da79c]">+{advantage}</span>
      )}
    </div>
  );
}

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

  // Group consecutive same-type pieces (input is sorted by value) so each
  // type renders as one tight overlapping stack — five pawns read as a pile,
  // not a fence — with clear air between different piece types.
  const groups: Array<{ type: PieceType; count: number }> = [];
  for (const type of pieces) {
    const last = groups[groups.length - 1];
    if (last && last.type === type) last.count++;
    else groups.push({ type, count: 1 });
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {groups.length > 0 && (
        <div className="flex items-center gap-1">
          {groups.map(({ type, count }, g) => {
            const Svg = getPieceSvg(type, color);
            return (
              <div key={`${type}-${g}`} className="flex items-center">
                {Array.from({ length: count }, (_, i) => (
                  <Svg
                    key={i}
                    className={cn('h-[18px] w-[18px] shrink-0', glow, i > 0 && '-ml-2')}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
      {advantage > 0 && (
        <span className="font-mono text-[13px] tabular-nums text-brass">+{advantage}</span>
      )}
    </div>
  );
}

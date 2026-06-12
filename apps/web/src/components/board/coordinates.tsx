'use client';

import type { Orientation } from '@/lib/board/types';
import { fileLabel, rankLabel } from '@/lib/board/coord-toggle';

interface CoordinatesProps {
  orientation: Orientation;
}

const COORD_FONT_SIZE = 'max(9px, calc(var(--board-sq-size) * 0.14))';

/**
 * In-square corner coordinates (lichess-style): rank numbers in the top-right
 * corner of the rightmost file, file letters in the bottom-left corner of the
 * bottom rank. Labels use the --board-coord-on-light/-dark vars — which
 * default to the opposite square colour but are overridden by themes whose
 * square pair lacks text contrast — so they read on both square tones without
 * a gutter.
 *
 * The bottom-right square of the board is always light regardless of
 * orientation, so square colour alternates from `index % 2 === 1` (light) on
 * both axes.
 */
export function Coordinates({ orientation }: CoordinatesProps) {
  return (
    <>
      <div className="absolute right-0 top-0 bottom-0 flex flex-col">
        {Array.from({ length: 8 }, (_, i) => {
          const onLight = i % 2 === 1;
          return (
            <div
              key={i}
              className="flex items-start justify-end pr-[3px] pt-[2px] font-mono font-semibold select-none"
              style={{
                height: 'var(--board-sq-size)',
                fontSize: COORD_FONT_SIZE,
                color: onLight
                  ? 'hsl(var(--board-coord-on-light))'
                  : 'hsl(var(--board-coord-on-dark))',
              }}
            >
              {rankLabel(i, orientation)}
            </div>
          );
        })}
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex flex-row">
        {Array.from({ length: 8 }, (_, i) => {
          const onLight = i % 2 === 1;
          return (
            <div
              key={i}
              className="flex items-end justify-start pl-[3px] pb-[2px] font-mono font-semibold select-none"
              style={{
                width: 'var(--board-sq-size)',
                fontSize: COORD_FONT_SIZE,
                color: onLight
                  ? 'hsl(var(--board-coord-on-light))'
                  : 'hsl(var(--board-coord-on-dark))',
              }}
            >
              {fileLabel(i, orientation)}
            </div>
          );
        })}
      </div>
    </>
  );
}

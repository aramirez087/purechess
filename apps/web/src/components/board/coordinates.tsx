'use client';

import type { Orientation } from '@/lib/board/types';
import { fileLabel, rankLabel } from '@/lib/board/coord-toggle';

interface CoordinatesProps {
  orientation: Orientation;
}

export function Coordinates({ orientation }: CoordinatesProps) {
  return (
    <>
      <div className="absolute right-0 top-0 flex flex-col" style={{ width: '16px' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-[10px] font-mono text-muted-foreground select-none"
            style={{ height: 'var(--board-sq-size)' }}
          >
            {rankLabel(i, orientation)}
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 left-0 flex flex-row" style={{ height: '14px' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-[10px] font-mono text-muted-foreground select-none"
            style={{ width: 'var(--board-sq-size)' }}
          >
            {fileLabel(i, orientation)}
          </div>
        ))}
      </div>
    </>
  );
}

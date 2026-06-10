'use client';

import { useLayoutEffect, useState } from 'react';
import type { Square } from '@purechess/shared';
import { MOVE_DURATION_MS } from '@/lib/board/animations';
import { Piece } from './piece';
import type { MoveAnimation } from './hooks/use-move-animation';

function squareOffset(square: Square, orientation: 'white' | 'black') {
  const fileIdx = square.charCodeAt(0) - 97;
  const rankIdx = 8 - Number(square[1]);
  return {
    x: orientation === 'white' ? fileIdx : 7 - fileIdx,
    y: orientation === 'white' ? rankIdx : 7 - rankIdx,
  };
}

/**
 * Slides the moved piece(s) from origin to destination square. Rendered above
 * the static pieces (which hide their destination square while the slide is
 * in flight). Percentage padding mirrors the 4%-of-square inset the static
 * pieces get (4% of a square = 0.5% of the board-sized layer).
 */
export function AnimationLayer({
  anim,
  orientation,
}: {
  anim: MoveAnimation;
  orientation: 'white' | 'black';
}) {
  const [arrived, setArrived] = useState(false);

  useLayoutEffect(() => {
    setArrived(false);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setArrived(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [anim.key]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30">
      {anim.pieces.map(({ piece, from, to }) => {
        const a = squareOffset(from, orientation);
        const b = squareOffset(to, orientation);
        const at = arrived ? b : a;
        return (
          <div
            key={`${anim.key}-${from}${to}`}
            className="absolute left-0 top-0 h-[12.5%] w-[12.5%] p-[0.5%] will-change-transform"
            style={{
              transform: `translate(${at.x * 100}%, ${at.y * 100}%)`,
              transition: arrived
                ? `transform ${MOVE_DURATION_MS}ms cubic-bezier(0.25, 0.9, 0.3, 1)`
                : 'none',
            }}
          >
            <Piece type={piece.type} color={piece.color} />
          </div>
        );
      })}
    </div>
  );
}

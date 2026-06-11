'use client';

import { useLayoutEffect, useState } from 'react';
import type { Square } from '@purechess/shared';
import { MOVE_DURATION_MS } from '@/lib/board/animations';
import { Piece } from './piece';
import type { MoveAnimation } from './hooks/use-move-animation';

const CAPTURE_FADE_MS = 90;
const SETTLE_MS = 60;

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
 *
 * On captures the victim holds at its square and dissolves over the final
 * ~90ms of the slide, so the mover visibly displaces it instead of the piece
 * vanishing at move start. Arriving pieces settle (scale 1.04 -> 1) in the
 * 60ms after the slide. Reduced motion / data-no-animations never reach this
 * layer (useMoveAnimation returns null), so both effects are killed with it.
 */
export function AnimationLayer({
  anim,
  orientation,
}: {
  anim: MoveAnimation;
  orientation: 'white' | 'black';
}) {
  const [arrived, setArrived] = useState(false);
  const [settled, setSettled] = useState(false);
  const [victimFading, setVictimFading] = useState(false);

  useLayoutEffect(() => {
    setArrived(false);
    setSettled(false);
    setVictimFading(false);
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setArrived(true);
        fadeTimer = setTimeout(
          () => setVictimFading(true),
          Math.max(0, MOVE_DURATION_MS - CAPTURE_FADE_MS),
        );
        settleTimer = setTimeout(() => setSettled(true), MOVE_DURATION_MS);
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [anim.key]);

  const captured = anim.captured;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30">
      {captured &&
        (() => {
          const { piece, at } = captured;
          const v = squareOffset(at, orientation);
          return (
            <div
              key={`${anim.key}-x${at}`}
              className="absolute left-0 top-0 h-[12.5%] w-[12.5%] p-[0.5%]"
              style={{
                transform: `translate(${v.x * 100}%, ${v.y * 100}%)`,
                opacity: victimFading ? 0 : 1,
                transition: victimFading ? `opacity ${CAPTURE_FADE_MS}ms ease-out` : 'none',
              }}
            >
              <Piece type={piece.type} color={piece.color} />
            </div>
          );
        })()}
      {anim.pieces.map(({ piece, from, to }) => {
        const a = squareOffset(from, orientation);
        const b = squareOffset(to, orientation);
        const at = arrived ? b : a;
        const scale = arrived && !settled ? 1.04 : 1;
        return (
          <div
            key={`${anim.key}-${from}${to}`}
            className="absolute left-0 top-0 h-[12.5%] w-[12.5%] p-[0.5%] will-change-transform"
            style={{
              transform: `translate(${at.x * 100}%, ${at.y * 100}%) scale(${scale})`,
              transition: arrived
                ? settled
                  ? `transform ${SETTLE_MS}ms ease-out`
                  : `transform ${MOVE_DURATION_MS}ms cubic-bezier(0.25, 0.9, 0.3, 1)`
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

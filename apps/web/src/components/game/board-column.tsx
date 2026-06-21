'use client';

import { cn } from '@/lib/utils';
import { PlayerStrip, type PlayerStripProps } from './player-strip';

export interface BoardColumnProps {
  topPlayer: PlayerStripProps;
  bottomPlayer: PlayerStripProps;
  /** The `<Chessboard/>` element. */
  children: React.ReactNode;
  /** Absolutely-positioned overlay inside the board frame (e.g. a thinking spinner). */
  overlay?: React.ReactNode;
  /**
   * Optional vertical evaluation bar rendered flush against the board frame's
   * left edge (review pages). Must be a self-stretching element.
   */
  evalBar?: React.ReactNode;
  className?: string;
}

/**
 * Centers a board between two player strips and sizes the board to the largest
 * square that fits the available space.
 *
 * On `lg+` the board is height-bounded: the board box is `aspect-square h-full
 * max-h-full w-auto max-w-full` inside a `flex-1 min-h-0` cell, so it fills the
 * viewport height (the cell gets a definite height from the GameShell's
 * `100dvh` → `min-h-0` chain) and clamps to the cell width when that is
 * narrower. On smaller screens the board is width-driven (`aspect-square
 * w-full`) and the rails stack below it.
 */
export function BoardColumn({
  topPlayer,
  bottomPlayer,
  children,
  overlay,
  evalBar,
  className,
}: BoardColumnProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center lg:h-full lg:min-h-0 lg:justify-center',
        className,
      )}
    >
      {/* The stack width tracks the board: on lg it is capped by the available
          viewport height (100dvh minus the top bar, paddings, both strips and
          gaps) so the square board never overflows vertically, and the strips —
          being `w-full` of this same stack — align exactly to the board edges. */}
      <div className="flex w-full flex-col gap-2 sm:gap-3 lg:max-w-[min(100%,calc(100dvh-var(--board-reserve,13rem)))]">
        <PlayerStrip {...topPlayer} />

        <div className="flex items-stretch gap-2">
          {evalBar}
          {/* Concentric bezel: outer 14px radius − 7px padding = inner 7px radius. */}
          <div className="board-frame relative mx-auto aspect-square w-full min-w-0 rounded-[14px] border p-[7px]">
            <div className="board-frame-inner relative h-full w-full overflow-hidden rounded-[7px] [&>*]:h-full">
              {children}
            </div>
            {overlay}
          </div>
        </div>

        <PlayerStrip {...bottomPlayer} />
      </div>
    </div>
  );
}

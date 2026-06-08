'use client';

import { cn } from '@/lib/utils';
import { GameTopBar } from './game-top-bar';

export interface GameShellProps {
  /** Top app bar. Defaults to a plain <GameTopBar/>. */
  topBar?: React.ReactNode;
  /**
   * Optional left info rail. When omitted the shell collapses to a
   * board-dominant 2-zone grid (board · right rail), letting the board grow to
   * fill the viewport height instead of being width-starved by a third column.
   */
  leftRail?: React.ReactNode;
  /** The center board column (typically a <BoardColumn/>). */
  board: React.ReactNode;
  rightRail: React.ReactNode;
  className?: string;
}

/**
 * Full-bleed, viewport-filling game frame: a slim top bar over a responsive
 * grid. With a `leftRail` it is a 3-zone grid (left rail · board · right rail);
 * without one it collapses to a board-dominant 2-zone grid so the square board
 * is bounded by viewport height, not a narrow center column. Owns the single
 * `#main-content` landmark.
 *
 * The board's height-bounding depends on an unbroken definite-height chain:
 * `h-[100dvh]` → `flex-1 min-h-0` main → grid `h-full min-h-0` → board cell.
 * On mobile the grid scrolls and the board comes first.
 */
export function GameShell({ topBar, leftRail, board, rightRail, className }: GameShellProps) {
  const hasLeft = leftRail != null;
  return (
    <div
      className={cn(
        'flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#0b0d0b] text-[#f1eee6]',
        className,
      )}
    >
      {topBar ?? <GameTopBar />}
      <main id="main-content" className="min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            'mx-auto grid h-full min-h-0 w-full grid-cols-1 gap-4 overflow-y-auto px-3 py-3 lg:gap-6 lg:overflow-hidden lg:px-6 lg:py-5',
            hasLeft
              ? 'max-w-[1600px] lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)_minmax(300px,360px)]'
              : 'max-w-[1760px] lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]',
          )}
        >
          {hasLeft && (
            <div className="order-2 min-w-0 lg:order-1 lg:min-h-0 lg:overflow-y-auto">{leftRail}</div>
          )}
          <div className="order-1 min-h-0 lg:order-2">{board}</div>
          <div className="order-3 flex min-w-0 flex-col lg:order-3 lg:min-h-0 lg:overflow-hidden">
            {rightRail}
          </div>
        </div>
      </main>
    </div>
  );
}

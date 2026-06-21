import { cn } from '@/lib/utils';

export interface GameLoadingSkeletonProps {
  className?: string;
}

/**
 * Board-shaped skeleton mirroring the GameShell 2-zone geometry (board column +
 * notation rail) so the real board does not jump when the client mounts. The
 * 10.5rem reserve matches the game clients' `[--board-reserve:10.5rem]`.
 *
 * The rail is one continuous rounded-[10px] bordered block with an internal
 * 3.25rem header strip, matching GameRail's unified silhouette (no detached
 * header bar — that would sit off the 14/10 radius scale).
 *
 * Shared by the /play/[gameId] and /computer-game/[gameId] route loading
 * states; purely presentational so game clients can render it directly too.
 */
export function GameLoadingSkeleton({ className }: GameLoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading game"
      className={cn('flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background', className)}
    >
      <div className="mx-auto grid h-full min-h-0 w-full max-w-[1760px] grid-cols-1 gap-4 overflow-y-auto px-3 py-3 lg:justify-center lg:grid-cols-[auto_minmax(340px,400px)] lg:gap-6 lg:overflow-hidden lg:px-6 lg:py-5">
        <div className="flex w-full flex-col items-center lg:h-full lg:min-h-0 lg:w-[min(calc(100dvh-10.5rem),calc(100vw-27rem))] lg:justify-center">
          <div className="flex w-full flex-col gap-2 sm:gap-3 lg:max-w-[min(100%,calc(100dvh-10.5rem))]">
            <div className="skeleton-shimmer h-[3.25rem] w-full rounded-[10px] border border-border/60 bg-surface" />
            <div className="skeleton-shimmer aspect-square w-full overflow-hidden rounded-[14px] border border-border bg-raised">
              {/* Faint 8×8 board silhouette. This is a real painted element
                  (SVG), so the browser fires First/Largest Contentful Paint the
                  moment the skeleton lands — the rest of the skeleton is pure
                  background-color, which the FCP/LCP spec ignores, so without
                  this the metrics wait for the real board's piece images (~6 s
                  under throttled load). On-brand: the board is the product, so
                  the loading state shows a board. (S07) */}
              <BoardSilhouette />
            </div>
            <div className="skeleton-shimmer h-[3.25rem] w-full rounded-[10px] border border-border/60 bg-surface" />
          </div>
        </div>
        <div className="hidden min-h-0 flex-col lg:flex">
          <div className="skeleton-shimmer flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-border/60 bg-surface">
            <div className="h-[3.25rem] shrink-0 border-b border-border/60" />
            <div className="min-h-0 flex-1" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading game</span>
    </div>
  );
}

/**
 * A faint dark-square checker over the board placeholder. Rendered as SVG (not
 * background-color) so it counts as contentful paint. Kept very low-contrast to
 * stay within the Silent Tournament dark aesthetic — it reads as a quiet board
 * shape, not a loud placeholder.
 */
function BoardSilhouette() {
  const darkCells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if ((x + y) % 2 === 1) darkCells.push({ x, y });
    }
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 8 8"
      preserveAspectRatio="none"
      className="h-full w-full"
      shapeRendering="crispEdges"
    >
      <rect x="0" y="0" width="8" height="8" fill="hsl(var(--skeleton-board-light))" />
      {darkCells.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="hsl(var(--skeleton-board-dark))" />
      ))}
    </svg>
  );
}
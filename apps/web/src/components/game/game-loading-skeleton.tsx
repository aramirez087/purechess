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
      className={cn(
        'flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#0b0d0b]',
        className,
      )}
    >
      <div className="mx-auto grid h-full min-h-0 w-full max-w-[1760px] grid-cols-1 gap-4 overflow-y-auto px-3 py-3 lg:justify-center lg:grid-cols-[auto_minmax(340px,400px)] lg:gap-6 lg:overflow-hidden lg:px-6 lg:py-5">
        <div className="flex w-full flex-col items-center lg:h-full lg:min-h-0 lg:w-[min(calc(100dvh-10.5rem),calc(100vw-27rem))] lg:justify-center">
          <div className="flex w-full flex-col gap-2 sm:gap-3 lg:max-w-[min(100%,calc(100dvh-10.5rem))]">
            <div className="skeleton-shimmer h-[3.25rem] w-full rounded-[10px] border border-[#2b332c]/60 bg-[#121511]" />
            <div className="skeleton-shimmer aspect-square w-full rounded-[14px] border border-[#2b332c] bg-[#181c17]" />
            <div className="skeleton-shimmer h-[3.25rem] w-full rounded-[10px] border border-[#2b332c]/60 bg-[#121511]" />
          </div>
        </div>
        <div className="hidden min-h-0 flex-col lg:flex">
          <div className="skeleton-shimmer flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-[#2b332c]/60 bg-[#121511]">
            <div className="h-[3.25rem] shrink-0 border-b border-[#2b332c]/60" />
            <div className="min-h-0 flex-1" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading game</span>
    </div>
  );
}

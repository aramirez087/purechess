import { GameLoadingSkeleton } from '@/components/game/game-loading-skeleton';

/** Route-level loading UI for /play/[gameId]. */
export default function LiveGameLoading() {
  return <GameLoadingSkeleton />;
}

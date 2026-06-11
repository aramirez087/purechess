'use client';

import { GameErrorState } from '@/components/game';

export default function GameError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <GameErrorState
      message={
        error.digest
          ? `Error reference: ${error.digest}`
          : 'Something went wrong while loading this game.'
      }
      backHref="/games"
      backLabel="Back to games"
      onRetry={reset}
    />
  );
}

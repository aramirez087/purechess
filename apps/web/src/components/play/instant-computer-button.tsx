'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CreateComputerGameDto } from '@purechess/shared';
import { createComputerGame } from '@/lib/api/computer-games';
import { posthog } from '@/lib/posthog';
import { cn } from '@/lib/utils';

const DEFAULT_COMPUTER_GAME: CreateComputerGameDto = {
  level: 4,
  color: 'random',
  timeControlSeconds: 0,
  incrementSeconds: 0,
};

type InstantComputerButtonProps = {
  children: React.ReactNode;
  className?: string;
  analyticsSource?: string;
};

export function InstantComputerButton({
  children,
  className,
  analyticsSource = 'unknown',
}: InstantComputerButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    if (isPending) return;
    setIsPending(true);
    setError(false);
    posthog.capture('play_clicked', {
      mode: 'computer',
      instant: true,
      source: analyticsSource,
    });

    try {
      const game = await createComputerGame(DEFAULT_COMPUTER_GAME);
      router.push(`/computer-game/${game.gameId}`);
    } catch {
      setError(true);
      setIsPending(false);
    }
  }

  return (
    <span className="flex w-full flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label="Start a computer game"
        className={cn(className, isPending && 'cursor-wait opacity-80')}
      >
        {isPending ? 'Starting...' : children}
      </button>
      {error ? (
        <span role="status" className="text-center text-xs text-destructive">
          Could not start. Check the API and try again.
        </span>
      ) : null}
    </span>
  );
}

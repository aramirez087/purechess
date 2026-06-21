'use client';

import Link from 'next/link';
import { GameRailButton } from '@/components/game/game-rail-button';

export interface GameErrorStateProps {
  /** Raw error message from the API — echoed verbatim in the small print. */
  message: string;
  /** Destination of the primary action. */
  backHref?: string;
  /** Label for the primary action. */
  backLabel?: string;
  /** When provided, renders a ghost "Try again" action. */
  onRetry?: () => void;
}

function getVerdict(message: string): { verdict: string; explanation: string } {
  const m = message.toLowerCase();
  if (m.includes('not your game')) {
    return {
      verdict: "This board isn't yours.",
      explanation: 'This game belongs to another account. Sign in as its owner, or start one of your own.',
    };
  }
  if (m.includes('not found') || m.includes('404')) {
    return {
      verdict: 'This game has vanished.',
      explanation: 'It may have been removed, or the link no longer points to a game.',
    };
  }
  return {
    verdict: 'The position was lost.',
    explanation: 'Something went wrong while loading this game. It is usually temporary.',
  };
}

/**
 * Branded full-screen error for the game clients. Owns the `#main-content`
 * landmark, mirroring the loading/error branches it replaces.
 */
export function GameErrorState({
  message,
  backHref = '/play',
  backLabel = 'Back to play',
  onRetry,
}: GameErrorStateProps) {
  const { verdict, explanation } = getVerdict(message);
  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground"
    >
      <div className="animate-rise w-full max-w-md text-center">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Purechess
        </p>
        <h1 className="font-display mt-4 text-[clamp(2rem,5vw,2.75rem)] italic leading-tight text-foreground">
          {verdict}
        </h1>
        <div
          aria-hidden="true"
          className="mx-auto mt-5 h-px w-24 bg-gradient-to-r from-transparent via-brass/80 to-transparent"
        />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{explanation}</p>
        <div className="mt-7 flex items-center justify-center gap-2">
          <Link
            href={backHref}
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[7px] bg-foreground px-4 text-sm font-semibold text-background transition-[color,background-color,border-color,transform] duration-150 hover:bg-foreground/90 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {backLabel}
          </Link>
          {onRetry && (
            <GameRailButton onClick={onRetry} className="border-transparent hover:bg-raised">
              Try again
            </GameRailButton>
          )}
        </div>
        <p className="mt-8 font-mono text-xs text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}
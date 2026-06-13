'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Puzzle } from 'lucide-react';
import { fetchPuzzleRating } from '@/lib/api/puzzles';

/**
 * A compact puzzle-rating stat for the own-profile ratings area. Additive and
 * self-contained — it fetches the user's puzzle Glicko client-side so it can't
 * disturb the game-ratings card or the shared ProfileDto. Renders nothing until
 * the rating loads (and silently stays hidden on error), so a profile with no
 * puzzle activity just shows the default 1500 once fetched. Links into the
 * stats surface. Mirrors the RatingsCard's panel styling.
 */
export function PuzzleRatingPill() {
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchPuzzleRating()
      .then((r) => {
        if (active) setRating(Math.round(r.rating));
      })
      .catch(() => {
        // Signed-out / error — leave the pill hidden rather than show a stub.
      });
    return () => {
      active = false;
    };
  }, []);

  if (rating === null) return null;

  return (
    <Link
      href="/puzzles/stats"
      data-testid="puzzle-rating-pill"
      className="group flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface/60 px-5 py-3.5 shadow-elevated transition-colors hover:border-brass/50"
    >
      <span className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-brass/10 text-brass ring-1 ring-inset ring-brass/25">
          <Puzzle className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Puzzle rating
          </span>
          <span className="font-mono text-xl font-semibold leading-tight tabular-nums text-foreground">
            {rating}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-brass">
        Stats
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

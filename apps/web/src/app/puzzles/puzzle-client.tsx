'use client';

import { useEffect, useRef } from 'react';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { PuzzleBoard } from '@/components/puzzle/puzzle-board';
import { usePuzzle } from '@/hooks/use-puzzle';
import {
  puzzleFailed,
  puzzleSolved,
  puzzleStarted,
} from '@/lib/analytics/training-events';

function formatPlays(plays: number): string {
  if (plays >= 1000) return `${(plays / 1000).toFixed(1)}k`;
  return String(plays);
}

export function PuzzleClient() {
  const { state, puzzleData, onMove, onReveal, onNext, onTryAgain } = usePuzzle();
  const solving = state.solvingColor === 'w' ? 'White' : 'Black';

  // Analytics: the daily puzzle solve loop (consent-gated wrapper). The daily
  // hook has no server recordAttempt, so fire from the phase transitions here.
  const startedForRef = useRef<string | null>(null);
  const settledForRef = useRef<string | null>(null);
  const puzzle = puzzleData?.puzzle;
  useEffect(() => {
    if (!puzzle) return;
    if (startedForRef.current !== puzzle.id) {
      startedForRef.current = puzzle.id;
      settledForRef.current = null;
      puzzleStarted('daily', puzzle.themes[0] ?? null);
    }
    if (
      (state.phase === 'success' || state.phase === 'fail') &&
      settledForRef.current !== puzzle.id
    ) {
      settledForRef.current = puzzle.id;
      const payload = { source: 'daily' as const, theme: puzzle.themes[0] ?? null, rating: puzzle.rating };
      if (state.phase === 'success') puzzleSolved(payload);
      else puzzleFailed(payload);
    }
  }, [puzzle, state.phase]);

  return (
    <BoardSettingsProvider>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
        <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-border/60 pb-4">
          <h1 className="font-display text-2xl italic tracking-[-0.01em] text-foreground sm:text-3xl">
            Daily Puzzle
          </h1>
          {puzzleData && (
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Puzzle #{puzzleData.puzzle.id}
            </span>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="flex flex-col gap-4">
            <div className="mx-auto w-full max-w-[560px]">
              <PuzzleBoard
                state={state}
                puzzleData={puzzleData}
                onMove={onMove}
                onReveal={onReveal}
                onTryAgain={onTryAgain}
                onNext={onNext}
              />
            </div>

            {/* Reserve the line height so revealing/clearing the prompt never
                shifts the board. */}
            <p className="min-h-[1.5rem] text-center text-sm text-muted-foreground">
              {state.phase === 'player' ? (
                <>
                  Find the best move for{' '}
                  <span className="font-medium text-foreground">{solving}</span>.
                </>
              ) : (
                ' '
              )}
            </p>
          </div>

          <aside className="flex flex-col gap-4 lg:pt-1">
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Puzzle info
            </h2>
            {puzzleData ? (
              <dl className="flex flex-col gap-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Rating</dt>
                  <dd className="font-medium text-foreground">{puzzleData.puzzle.rating}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Plays</dt>
                  <dd className="font-medium text-foreground">
                    {formatPlays(puzzleData.puzzle.plays)}
                  </dd>
                </div>
                <div className="flex flex-col gap-1.5 pt-1">
                  <dt className="text-muted-foreground">Themes</dt>
                  <dd>
                    {state.phase === 'success' ? (
                      <div className="flex flex-wrap gap-1.5">
                        {puzzleData.puzzle.themes.map((theme) => (
                          <span
                            key={theme}
                            className="rounded-full border border-border bg-raised px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs italic text-muted-foreground/70">
                        Revealed after solving
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </aside>
        </div>
      </div>
    </BoardSettingsProvider>
  );
}

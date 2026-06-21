'use client';

import { ChartLine, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GameRailButton } from '@/components/game/game-rail-button';

export type ResultTone = 'win' | 'loss' | 'draw';

/**
 * The big serif word for the result moment. Checkmate keeps its iconic name
 * for both sides; everything else resolves to a verdict word, with the
 * mechanical reason relegated to the small line underneath.
 */
function getTheaterWord(tone: ResultTone, reasonLabel: string | null): string {
  if (reasonLabel === 'Checkmate') return 'Checkmate.';
  if (reasonLabel === 'Stalemate') return 'Stalemate.';
  if (tone === 'win') return 'Victory.';
  if (tone === 'loss') return 'Defeat.';
  return 'Draw.';
}

// Staggered brass sparks for the victory moment — quiet celebration, no
// confetti clutter. Pure CSS; reduced-motion kills the animation.
const SPARKS: Array<{ left: string; top: string; size: number; delay: string }> = [
  { left: '18%', top: '62%', size: 5, delay: '0s' },
  { left: '30%', top: '74%', size: 3, delay: '0.7s' },
  { left: '42%', top: '68%', size: 4, delay: '1.5s' },
  { left: '57%', top: '76%', size: 3, delay: '0.3s' },
  { left: '68%', top: '64%', size: 5, delay: '1.1s' },
  { left: '80%', top: '72%', size: 4, delay: '1.9s' },
  { left: '25%', top: '38%', size: 3, delay: '1.3s' },
  { left: '74%', top: '34%', size: 3, delay: '0.5s' },
];

/**
 * Game-over card rendered on top of the board (via BoardColumn's `overlay`
 * slot). Win tone gets the brass halo + rising sparks. `onRematch` is
 * optional — omit it where rematch isn't available.
 */
export function ResultOverlay({
  tone,
  resultLabel,
  reasonLabel,
  onDismiss,
  onRematch,
  analyzeHref,
}: {
  tone: ResultTone;
  resultLabel: string;
  reasonLabel: string | null;
  onDismiss: () => void;
  onRematch?: () => void;
  /** Link to the game's review page — omit where review isn't available. */
  analyzeHref?: string;
}) {
  const toneRing: Record<ResultTone, string> = {
    win: 'shadow-[0_28px_90px_-20px_hsl(var(--brass)/0.5)]',
    draw: 'shadow-[0_28px_80px_-26px_hsl(var(--shadow-rgb)/0.7)]',
    loss: 'shadow-[0_28px_80px_-26px_hsl(var(--shadow-rgb)/0.7)]',
  };
  const toneWord: Record<ResultTone, string> = {
    win: 'text-[hsl(var(--result-word-win))]',
    draw: 'text-[hsl(var(--result-word-neutral))]',
    loss: 'text-[hsl(var(--result-word-neutral))]',
  };
  const toneRule: Record<ResultTone, string> = {
    win: 'via-brass/80',
    draw: 'via-muted-foreground/60',
    loss: 'via-destructive/60',
  };
  return (
    <div
      data-testid="game-result"
      className="result-scrim absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-[10px] p-4 backdrop-blur-[4px]"
    >
      {tone === 'win' && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(circle, hsl(var(--brass) / 0.26) 0%, hsl(var(--brass) / 0.07) 45%, transparent 70%)',
              animation: 'victory-halo 2.8s ease-out infinite',
            }}
          />
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-brass/80"
              style={{
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                boxShadow: '0 0 8px 2px hsl(var(--brass) / 0.55)',
                animation: `victory-spark 3s ease-in-out ${s.delay} infinite`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}
      <div
        role="alert"
        className={cn(
          'result-card animate-rise w-full max-w-[min(100%,26rem)] rounded-[14px] border border-border/90 px-6 pb-7 pt-8 text-center',
          toneRing[tone],
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          {resultLabel}
        </p>
        <p
          className={cn(
            'font-display mt-3 text-[clamp(2.5rem,6vw,3.25rem)] italic leading-none tracking-[-0.01em]',
            toneWord[tone],
          )}
        >
          {getTheaterWord(tone, reasonLabel)}
        </p>
        <div
          aria-hidden
          className={cn(
            'mx-auto mt-4 h-px w-2/3 bg-gradient-to-r from-transparent to-transparent',
            toneRule[tone],
          )}
        />
        {reasonLabel && (
          <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--result-reason))]">
            by {reasonLabel}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <GameRailButton size="md" fullWidth onClick={onDismiss}>
            View board
          </GameRailButton>
          {analyzeHref && (
            <GameRailButton size="md" fullWidth href={analyzeHref}>
              <ChartLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              Analyze
            </GameRailButton>
          )}
          {onRematch ? (
            <GameRailButton size="md" variant="brass" fullWidth onClick={onRematch}>
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
              Rematch
            </GameRailButton>
          ) : null}
          <GameRailButton
            size="md"
            fullWidth
            href="/play"
            className={cn(
              // Odd count (e.g. View + Analyze + New) — give "New" the full bottom row.
              !onRematch && analyzeHref && 'col-span-2',
            )}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            New
          </GameRailButton>
        </div>
      </div>
    </div>
  );
}
'use client';

import { Flame, Timer, XCircle } from 'lucide-react';
import type { RushMode } from '@purechess/shared';
import { cn } from '@/lib/utils';
import { clockTier } from '@/lib/board/clock-tier';
import { useBoardSettings } from '@/components/board/board-context';

/**
 * The live rush HUD: a big countdown (3min) or strikes-remaining (5strikes), a
 * brass score, and the current combo. Under 15s the timer goes red and pulses,
 * reusing the EXISTING `clock-pulse` keyframes from globals.css (same treatment
 * as PlayerStrip's critical/dying clock chips) — no new keyframes invented.
 *
 * Presentational only: the clock + strike state are owned by the run client.
 */

const MAX_STRIKES = 5;
/** Below this remaining time the timer goes red + pulses (the accelerate cue). */
const PULSE_UNDER_MS = 15_000;

export interface RushHudProps {
  mode: RushMode;
  /** Remaining clock in ms (mode '3min'); ignored for '5strikes'. */
  timeMs?: number;
  /** Wrong answers so far (mode '5strikes' ends at {@link MAX_STRIKES}). */
  strikes: number;
  /** Correct solves so far — the score. */
  score: number;
  /** Current consecutive-correct combo. */
  combo: number;
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RushHud({ mode, timeMs, strikes, score, combo }: RushHudProps) {
  // The board-settings "animations off" toggle drives animationMs to 0; honor
  // it here too so the countdown pulse stops under the same switch as the
  // board (prefers-reduced-motion is handled by globals.css [class*='clock-pulse']).
  const { settings } = useBoardSettings();
  const motionOff = settings.animationMs === 0;
  const tier = clockTier(timeMs);
  const lowTime = mode === '3min' && typeof timeMs === 'number' && timeMs <= PULSE_UNDER_MS;
  const strikesLeft = Math.max(0, MAX_STRIKES - strikes);

  return (
    <div
      className="flex w-full items-center justify-between gap-4 rounded-[10px] border border-border bg-surface px-4 py-3"
      data-testid="rush-hud"
    >
      {/* Primary metric: countdown (3min) or strikes-remaining (5strikes). */}
      {mode === '3min' ? (
        <div
          className={cn(
            'flex items-center gap-2 rounded-[7px] border px-3 py-1.5 transition-colors motion-reduce:transition-none',
            lowTime
              ? 'border-red-700/60 bg-background/80 text-red-400'
              : 'border-border bg-raised text-foreground',
            // The pulse is the accelerate cue — kept unless animations are off
            // (settings switch) or the OS prefers reduced motion (globals.css).
            lowTime && !motionOff && 'animate-[clock-pulse_1s_ease-in-out_infinite]',
            tier === 'dying' && 'font-bold',
            tier === 'dying' && !motionOff && 'animate-[clock-pulse_0.4s_ease-in-out_infinite]',
          )}
          role="timer"
          aria-live="off"
          data-testid="rush-clock"
          data-low={lowTime ? '' : undefined}
        >
          <Timer className="h-4 w-4" aria-hidden="true" />
          <span className="font-mono text-2xl tabular-nums tracking-tight">
            {formatClock(timeMs ?? 0)}
          </span>
          <span className="sr-only">remaining</span>
        </div>
      ) : (
        <div
          className="flex items-center gap-1.5"
          data-testid="rush-strikes"
          aria-label={`${strikesLeft} strikes left`}
        >
          {Array.from({ length: MAX_STRIKES }).map((_, i) => (
            <XCircle
              key={i}
              className={cn(
                'h-5 w-5',
                i < strikes ? 'text-destructive' : 'text-muted-foreground/30',
              )}
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {/* Score — the brass accent, the one moment of gold on this surface. */}
      <div className="flex flex-col items-center leading-none">
        <span
          className="font-mono text-3xl font-semibold tabular-nums text-brass"
          data-testid="rush-score"
        >
          {score}
        </span>
        <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          score
        </span>
      </div>

      {/* Combo — a quiet flame that brightens with the streak. */}
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-[7px] border px-2.5 py-1.5 transition-colors motion-reduce:transition-none',
          combo >= 2 ? 'border-brass/40 text-brass' : 'border-border text-muted-foreground',
        )}
        data-testid="rush-combo"
        aria-label={`Combo ${combo}`}
      >
        <Flame
          className={cn('h-4 w-4', combo >= 2 ? 'text-brass' : 'text-muted-foreground/50')}
          aria-hidden="true"
        />
        <span className="font-mono text-sm tabular-nums">{combo}</span>
      </div>
    </div>
  );
}

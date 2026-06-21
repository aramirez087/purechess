'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CapturedMaterial } from './captured-material';
import { clockTier, type ClockTier } from '@/lib/board/clock-tier';
import type { CapturedSummary } from '@/lib/board/material';
import type { Color } from '@purechess/shared';

export interface PlayerStripProps {
  name: string;
  detail?: string;
  /** Which army this player commands — renders a board-color swatch by the name. */
  side?: 'white' | 'black';
  /** Highlights the strip (gold) — use for the side to move. */
  active?: boolean;
  /**
   * Quiet active treatment for replay/review cursors: brass left-bar + border
   * only (the same grammar as the move list's current ply), no gradient/glow.
   */
  subtle?: boolean;
  /** Short status pill, e.g. "Thinking" / "Your move". Announced politely. */
  status?: string;
  /** Pre-formatted clock string, e.g. "10:00". */
  clock?: string;
  /**
   * Raw remaining ms — drives the clock chip's urgency tier (amber under 30s,
   * red + pulse under 10s) and the brief brass flash when increment lands.
   */
  timeMs?: number;
  /** Score-sheet result chip for finished games: "1", "0" or "½". */
  resultChip?: string;
  /** Pieces this player has captured (opponent's color). */
  captured?: CapturedSummary;
  /** Color of the captured glyphs (the opponent's color). */
  capturedColor?: Color;
  /** Signed advantage from this player's perspective; shows `+N` when > 0. */
  advantage?: number;
  /** Optional avatar/identity glyph drawn in a circle left of the name. */
  avatar?: React.ReactNode;
}

/** Urgency styling applied to the clock chip only — the strip keeps its own
 * gold active treatment. `clock-pulse` keyframes live in globals.css. */
const CLOCK_TIER_STYLES: Record<Exclude<ClockTier, 'normal'>, string> = {
  caution:
    'border-[hsl(var(--clock-caution-border)/0.5)] bg-[hsl(var(--clock-caution-bg))] text-[hsl(var(--clock-caution-text))]',
  critical:
    'border-red-700/60 bg-[hsl(var(--clock-chip-bg))] text-red-400 animate-[clock-pulse_1s_ease-in-out_infinite]',
  dying:
    'border-red-600/80 bg-red-950/40 font-bold text-red-300 animate-[clock-pulse_0.4s_ease-in-out_infinite]',
  out: 'border-red-500 bg-red-950/60 text-red-200',
};

export function PlayerStrip({
  name,
  detail,
  side,
  active = false,
  subtle = false,
  status,
  clock,
  timeMs,
  resultChip,
  captured,
  capturedColor,
  advantage = 0,
  avatar,
}: PlayerStripProps) {
  const showCaptured = !!captured && captured.pieces.length > 0 && !!capturedColor;
  const tier = clockTier(timeMs);

  const prevTimeMsRef = useRef<number | undefined>(undefined);
  const [bonusFlash, setBonusFlash] = useState(false);
  useEffect(() => {
    const prev = prevTimeMsRef.current;
    prevTimeMsRef.current = timeMs;
    if (timeMs == null || prev == null) return;
    if (timeMs > prev && timeMs < 30_000) {
      setBonusFlash(true);
      const id = setTimeout(() => setBonusFlash(false), 400);
      return () => clearTimeout(id);
    }
  }, [timeMs]);

  return (
    <div
      className={cn(
        'flex min-h-[3.25rem] items-center gap-3 rounded-[10px] border px-3 py-2 transition-all duration-300',
        active && !subtle
          ? 'chrome-strip-active'
          : active && subtle
            ? 'chrome-strip-subtle'
            : 'chrome-strip',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {avatar && (
          <span
            aria-hidden="true"
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors',
              active && !subtle
                ? 'border-brass/60 bg-brass/15 text-[hsl(var(--move-active-text))]'
                : 'border-border bg-gradient-to-b from-[hsl(var(--avatar-from))] to-[hsl(var(--avatar-to))] text-muted-foreground shadow-inner-hairline',
            )}
          >
            {avatar}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {side && (
              <span
                role="img"
                aria-label={side === 'white' ? 'Plays white' : 'Plays black'}
                className={cn(
                  'h-2.5 w-2.5 shrink-0 rounded-[2px] ring-1 ring-inset',
                  side === 'white' ? 'bg-board-light ring-black/30' : 'bg-board-dark ring-border',
                )}
              />
            )}
            <p className="truncate text-sm font-semibold leading-tight">{name}</p>
          </div>
          {detail && (
            <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">{detail}</p>
          )}
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        {showCaptured && (
          <CapturedMaterial
            pieces={captured!.pieces}
            advantage={advantage}
            color={capturedColor!}
          />
        )}
        {status && (
          <span
            aria-live="polite"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-[hsl(var(--status-pill-bg))] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--status-pill-text))]"
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                active
                  ? 'bg-brass shadow-[0_0_8px_1px_hsl(var(--brass)/0.7)]'
                  : 'bg-[hsl(var(--status-dot-idle))]',
              )}
            />
            {status}
          </span>
        )}
        {resultChip && (
          <span className="font-mono text-sm font-semibold tabular-nums text-brass">
            <span aria-hidden="true">{resultChip}</span>
            <span className="sr-only">
              {resultChip === '1' ? 'Won' : resultChip === '0' ? 'Lost' : 'Draw'}
            </span>
          </span>
        )}
        {clock && (
          <div
            className={cn(
              'shrink-0 rounded-[7px] border px-2 py-0.5 sm:px-3 sm:py-1 font-mono text-base sm:text-xl font-semibold tabular-nums',
              'transition-[color,border-color,background-color,box-shadow] duration-300',
              tier === 'normal'
                ? active
                  ? 'border-brass/45 bg-[hsl(var(--clock-chip-active-bg))] text-[hsl(var(--move-active-text))]'
                  : 'border-border bg-[hsl(var(--clock-chip-bg))] text-muted-foreground'
                : CLOCK_TIER_STYLES[tier],
              bonusFlash && 'shadow-[0_0_0_2px_hsl(var(--brass)/0.7)]',
            )}
            suppressHydrationWarning
          >
            {clock}
          </div>
        )}
      </div>
    </div>
  );
}
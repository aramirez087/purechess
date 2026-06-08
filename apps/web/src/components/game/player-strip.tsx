'use client';

import { cn } from '@/lib/utils';
import { CapturedMaterial } from './captured-material';
import type { CapturedSummary } from '@/lib/board/material';
import type { Color } from '@purechess/shared';

export interface PlayerStripProps {
  name: string;
  detail?: string;
  /** Highlights the strip (gold) — use for the side to move. */
  active?: boolean;
  /** Short status pill, e.g. "Thinking" / "Your move". Announced politely. */
  status?: string;
  /** Pre-formatted clock string, e.g. "10:00". */
  clock?: string;
  /** Pieces this player has captured (opponent's color). */
  captured?: CapturedSummary;
  /** Color of the captured glyphs (the opponent's color). */
  capturedColor?: Color;
  /** Signed advantage from this player's perspective; shows `+N` when > 0. */
  advantage?: number;
}

export function PlayerStrip({
  name,
  detail,
  active = false,
  status,
  clock,
  captured,
  capturedColor,
  advantage = 0,
}: PlayerStripProps) {
  const showCaptured = !!captured && captured.pieces.length > 0 && !!capturedColor;

  return (
    <div
      className={cn(
        'flex min-h-12 items-center justify-between gap-3 rounded-[6px] border px-3 py-2 transition-colors',
        active
          ? 'border-[#d6b563]/45 bg-[#d6b563]/10 text-[#f8f1de]'
          : 'border-[#2b332c] bg-[#121511] text-[#f1eee6]',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium leading-tight">{name}</p>
          {status && (
            <span
              aria-live="polite"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#2b332c] bg-[#0b0d0b]/70 px-2 py-0.5 text-[10px] font-medium text-[#d8d2c3]"
            >
              <span
                aria-hidden="true"
                className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-[#d6b563]' : 'bg-[#4b554b]')}
              />
              {status}
            </span>
          )}
        </div>
        {(detail || showCaptured) && (
          <div className="mt-0.5 flex items-center gap-2">
            {detail && <p className="truncate text-xs leading-tight text-[#9da79c]">{detail}</p>}
            {showCaptured && (
              <CapturedMaterial pieces={captured!.pieces} advantage={advantage} color={capturedColor!} />
            )}
          </div>
        )}
      </div>
      {clock && (
        <div
          className={cn(
            'shrink-0 rounded-[5px] border px-3 py-1 font-mono text-xl font-semibold tabular-nums',
            active
              ? 'border-[#d6b563]/45 bg-[#0b0d0b] text-[#f8f1de]'
              : 'border-[#2b332c] bg-[#0b0d0b]/60 text-[#c7cfc4]',
          )}
        >
          {clock}
        </div>
      )}
    </div>
  );
}

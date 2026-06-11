'use client';

import { cn } from '@/lib/utils';
import { CapturedMaterial } from './captured-material';
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

export function PlayerStrip({
  name,
  detail,
  side,
  active = false,
  subtle = false,
  status,
  clock,
  resultChip,
  captured,
  capturedColor,
  advantage = 0,
  avatar,
}: PlayerStripProps) {
  const showCaptured = !!captured && captured.pieces.length > 0 && !!capturedColor;

  return (
    <div
      className={cn(
        'flex min-h-[3.25rem] items-center gap-3 rounded-[10px] border px-3 py-2 transition-all duration-300',
        active && !subtle
          ? 'border-[#d6b563]/50 bg-gradient-to-r from-[#d6b563]/[0.16] to-[#d6b563]/[0.03] text-[#f8f1de] shadow-[0_0_0_1px_rgba(214,181,99,0.16),0_0_34px_-12px_rgba(214,181,99,0.55)]'
          : active && subtle
            ? 'border-[#d6b563]/40 bg-gradient-to-b from-[#14180f] to-[#101410] text-[#f8f1de] shadow-[inset_2px_0_0_0_#d6b563]'
            : 'border-[#2b332c] bg-gradient-to-b from-[#14180f] to-[#101410] text-[#f1eee6]',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {avatar && (
          <span
            aria-hidden="true"
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors',
              active && !subtle
                ? 'border-[#d6b563]/60 bg-[#d6b563]/15 text-[#f3e7c4]'
                : 'border-[#2b332c] bg-gradient-to-b from-[#181c17] to-[#0d100c] text-[#c7cfc4] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
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
                  side === 'white'
                    ? 'bg-[#e9e4d4] ring-black/30'
                    : 'bg-[#3d4a40] ring-[#2b332c]',
                )}
              />
            )}
            <p className="truncate text-sm font-semibold leading-tight">{name}</p>
          </div>
          {detail && <p className="mt-0.5 truncate text-xs leading-tight text-[#9da79c]">{detail}</p>}
        </div>
      </div>

      {/* Right cluster: captured material reads outward from the name gap,
          status/result/clock anchor the strip's right edge. */}
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {showCaptured && (
          <CapturedMaterial pieces={captured!.pieces} advantage={advantage} color={capturedColor!} />
        )}
        {status && (
          <span
            aria-live="polite"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#2b332c] bg-[#0b0d0b]/70 px-2 py-0.5 text-[10px] font-medium text-[#d8d2c3]"
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                active ? 'bg-[#d6b563] shadow-[0_0_8px_1px_rgba(214,181,99,0.7)]' : 'bg-[#4b554b]',
              )}
            />
            {status}
          </span>
        )}
        {resultChip && (
          <span className="font-mono text-sm font-semibold tabular-nums text-[#d6b563]">
            <span aria-hidden="true">{resultChip}</span>
            <span className="sr-only">
              {resultChip === '1' ? 'Won' : resultChip === '0' ? 'Lost' : 'Draw'}
            </span>
          </span>
        )}
        {clock && (
          <div
            className={cn(
              'shrink-0 rounded-[7px] border px-3 py-1 font-mono text-xl font-semibold tabular-nums',
              active
                ? 'border-[#d6b563]/45 bg-[#0b0d0b] text-[#f8f1de]'
                : 'border-[#2b332c] bg-[#0b0d0b]/60 text-[#c7cfc4]',
            )}
          >
            {clock}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { pvToSan } from '@/lib/board/pv-to-san';
import type { EngineLine, PositionEval } from '@/hooks/use-position-eval';

/** Win-probability-ish share of the bar for White, from a White-POV cp. */
export function whiteShare(cp: number): number {
  const p = 2 / (1 + Math.exp(-0.004 * cp)) - 1;
  return 50 + 50 * p;
}

export function formatScore(cp?: number, mate?: number): string {
  if (mate !== undefined) return `#${Math.abs(mate)}`;
  if (cp === undefined) return '…';
  const pawns = cp / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

/** White's bar share for an eval, clamped so the losing side never vanishes. */
function shareFor(evaluation: PositionEval | null): number {
  const raw =
    evaluation?.mate !== undefined
      ? evaluation.mate > 0
        ? 100
        : 0
      : evaluation?.cp !== undefined
        ? whiteShare(evaluation.cp)
        : 50;
  return Math.min(97, Math.max(3, raw));
}

/**
 * Vertical evaluation bar for BoardColumn's `evalBar` slot: a bone fill
 * (White's share) anchored to White's side of the board, over a dark well,
 * with a brass tick at the 50% line and a tiny mono score cap pinned to the
 * winning side's edge. Self-stretching — the slot sizes it.
 */
export function EvalBar({
  evaluation,
  orientation = 'white',
  thinking = false,
  className,
}: {
  evaluation: PositionEval | null;
  /** Board orientation — the White fill anchors to White's edge. */
  orientation?: 'white' | 'black';
  /** Sweeps a scan-line over the fill while the engine searches. */
  thinking?: boolean;
  className?: string;
}) {
  const share = shareFor(evaluation);
  const hasScore = evaluation?.cp !== undefined || evaluation?.mate !== undefined;
  const whiteWinning =
    evaluation?.mate !== undefined ? evaluation.mate > 0 : (evaluation?.cp ?? 0) >= 0;
  // The cap pins to the winning side's edge — never tracks the fill boundary,
  // so it can't jiggle. White's edge is the bottom on a White-oriented board.
  const capAtBottom = whiteWinning === (orientation === 'white');

  return (
    <div
      role="img"
      aria-label={`Evaluation ${formatScore(evaluation?.cp, evaluation?.mate)}`}
      className={cn('relative w-3 shrink-0 self-stretch', className)}
    >
      <div className="absolute inset-0 overflow-hidden rounded-full border border-[#2b332c] bg-[#10140f]">
        <div
          className={cn(
            'absolute inset-x-0 bg-gradient-to-b from-[#f6f2e6] to-[#e9e4d4] transition-[height] duration-500 ease-out',
            orientation === 'white' ? 'bottom-0' : 'top-0',
          )}
          style={{ height: `${share}%` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#d6b563]/70"
        />
        {/* Search heartbeat: unmounts (no exit transition) the instant the
            search completes, so the final score snap stays crisp. */}
        {thinking && (
          <div
            aria-hidden="true"
            className="eval-scan pointer-events-none absolute inset-x-0 h-[14%] bg-gradient-to-b from-transparent via-[#f6f2e6]/25 to-transparent"
          />
        )}
      </div>
      {/* Quiet chrome: ink-on-bone over the fill, bone-on-well otherwise — no
          brass (the accent budget is spent on the 50% tick). The chip carries
          its own backing because the text is wider than the 12px bar and the
          spill would otherwise sit illegibly on the near-black stage. Hidden
          until the first eval lands; the score is already in the aria-label. */}
      {hasScore && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[3px] px-0.5 py-px font-mono text-[9px] font-semibold leading-none tabular-nums',
            capAtBottom ? 'bottom-1' : 'top-1',
            whiteWinning
              ? 'bg-[#e9e4d4] text-[#10140f]'
              : 'bg-[#10140f] text-[#e9e4d4] ring-1 ring-inset ring-[#2b332c]',
          )}
        >
          {formatScore(evaluation?.cp, evaluation?.mate)}
        </span>
      )}
    </div>
  );
}

/** Moves shown per PV row — keeps the rail-header readout one line per pv. */
const PV_MAX_MOVES = 6;

function LineRow({
  fen,
  cp,
  mate,
  depth,
  pv,
  primary,
  thinking,
}: {
  fen: string;
  cp?: number;
  mate?: number;
  /** Shown only on the primary row — the authoritative search depth. */
  depth?: number;
  pv: string[];
  primary: boolean;
  thinking: boolean;
}) {
  const san = useMemo(() => pvToSan(fen, pv, PV_MAX_MOVES), [fen, pv]);

  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span
        className={cn(
          'w-9 shrink-0 text-right font-mono text-[13px] font-semibold tabular-nums',
          primary ? 'text-[#d6b563]' : 'text-[#8a948a]',
          thinking && 'animate-pulse opacity-60',
        )}
      >
        {formatScore(cp, mate)}
      </span>
      <span className="w-7 shrink-0 font-mono text-[10px] tabular-nums text-[#8a948a]">
        {primary && depth !== undefined ? `d${depth}` : ''}
      </span>
      <span className="min-w-0 truncate font-mono text-[11px] text-[#9da79c]">
        {san.join(' ')}
        {pv.length > PV_MAX_MOVES && ' …'}
      </span>
    </span>
  );
}

/**
 * Engine readout for a rail header: one row per multipv line — mono score
 * (brass for the best line), depth on line 1 only, PV continuation in SAN.
 * Shares the parent's single usePositionEval search with <EvalBar/> — never
 * runs the engine itself. Lines 2-3 render only when `lines` carries them.
 */
export function EngineLines({
  fen,
  evaluation,
  thinking,
  lines,
}: {
  fen: string;
  evaluation: PositionEval | null;
  thinking: boolean;
  /** Multipv array (index 0 = best); omit for the single-line readout. */
  lines?: EngineLine[];
}) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <LineRow
        fen={fen}
        cp={evaluation?.cp}
        mate={evaluation?.mate}
        depth={evaluation?.depth}
        pv={evaluation?.pv ?? []}
        primary
        thinking={thinking}
      />
      {lines?.slice(1, 3).map((line, i) => (
        <LineRow
          key={i}
          fen={fen}
          cp={line.cp}
          mate={line.mate}
          pv={line.pv}
          primary={false}
          thinking={thinking}
        />
      ))}
    </span>
  );
}

/** Back-compat alias — same props, same rail-header slot. */
export const EvalReadout = EngineLines;

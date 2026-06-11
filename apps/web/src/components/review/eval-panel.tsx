'use client';

import { Chess } from 'chess.js';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { PositionEval } from '@/hooks/use-position-eval';

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

function uciToSan(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
    return move?.san ?? null;
  } catch {
    return null;
  }
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
 * with a brass tick at the 50% line. Self-stretching — the slot sizes it.
 */
export function EvalBar({
  evaluation,
  orientation = 'white',
  className,
}: {
  evaluation: PositionEval | null;
  /** Board orientation — the White fill anchors to White's edge. */
  orientation?: 'white' | 'black';
  className?: string;
}) {
  const share = shareFor(evaluation);

  return (
    <div
      role="img"
      aria-label={`Evaluation ${formatScore(evaluation?.cp, evaluation?.mate)}`}
      className={cn(
        'relative w-2.5 shrink-0 self-stretch overflow-hidden rounded-full border border-[#2b332c] bg-[#10140f]',
        className,
      )}
    >
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
    </div>
  );
}

/**
 * Compact engine readout for a rail header: mono score plus
 * "depth N · best SAN". Shares the parent's single usePositionEval search
 * with <EvalBar/> — never runs the engine itself.
 */
export function EvalReadout({
  fen,
  evaluation,
  thinking,
}: {
  fen: string;
  evaluation: PositionEval | null;
  thinking: boolean;
}) {
  const bestSan = useMemo(
    () => (evaluation ? uciToSan(fen, evaluation.bestmove) : null),
    [fen, evaluation],
  );

  return (
    <span className="flex items-baseline gap-2">
      <span
        className={cn(
          'font-mono text-sm font-semibold tabular-nums text-[#f1eee6] transition-opacity',
          thinking && 'opacity-50',
        )}
      >
        {formatScore(evaluation?.cp, evaluation?.mate)}
      </span>
      {evaluation && (
        <span className="text-[11px] text-[#8a948a]">
          depth {evaluation.depth}
          {bestSan && (
            <>
              {' · '}
              <span className="text-[#9da79c]">best {bestSan}</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}

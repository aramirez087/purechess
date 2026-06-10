'use client';

import { Chess } from 'chess.js';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { usePositionEval } from '@/hooks/use-position-eval';

/** Win-probability-ish share of the bar for White, from a White-POV cp. */
function whiteShare(cp: number): number {
  const p = 2 / (1 + Math.exp(-0.004 * cp)) - 1;
  return 50 + 50 * p;
}

function formatScore(cp?: number, mate?: number): string {
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

/**
 * Local-engine evaluation of the current review position: a White/Black
 * win-share bar, numeric score, depth, and the engine's preferred move.
 * Runs entirely in the browser (the same Stockfish worker computer games use).
 */
export function EvalPanel({ fen }: { fen: string }) {
  const { evaluation, thinking } = usePositionEval(fen, true);

  const share =
    evaluation?.mate !== undefined
      ? evaluation.mate > 0
        ? 100
        : 0
      : evaluation?.cp !== undefined
        ? whiteShare(evaluation.cp)
        : 50;

  const bestSan = useMemo(
    () => (evaluation ? uciToSan(fen, evaluation.bestmove) : null),
    [fen, evaluation],
  );

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span
          className={cn(
            'font-mono text-lg font-semibold tabular-nums text-[#f1eee6] transition-opacity',
            thinking && 'opacity-50',
          )}
        >
          {formatScore(evaluation?.cp, evaluation?.mate)}
        </span>
        {evaluation && (
          <span className="text-[11px] text-[#6f7a70]">
            depth {evaluation.depth}
            {bestSan && (
              <>
                {' · '}
                <span className="text-[#9da79c]">best {bestSan}</span>
              </>
            )}
          </span>
        )}
      </div>
      <div
        role="img"
        aria-label={`Evaluation ${formatScore(evaluation?.cp, evaluation?.mate)}`}
        className="h-2 overflow-hidden rounded-full bg-[#262b23] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#e9e4d4] to-[#f6f2e6] transition-[width] duration-500 ease-out"
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  );
}

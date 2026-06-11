'use client';

import { forwardRef, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { cn, formatTimeControl } from '@/lib/utils';
import type { GameHistorySummaryDto } from '@purechess/shared';

// Renders the <tr> itself (forwardRef + style + data-index) so the
// virtualized body can position/measure rows without nesting <tr> in <tr>.
type GameHistoryRowProps = {
  game: GameHistorySummaryDto;
  style?: CSSProperties;
  'data-index'?: number;
};

function resultLabel(r: GameHistorySummaryDto['result']): string {
  if (r === 'win') return 'Win';
  if (r === 'loss') return 'Loss';
  if (r === 'draw') return 'Draw';
  return 'No result';
}

// Scoresheet notation, always from white's perspective.
function scoreNotation(
  result: GameHistorySummaryDto['result'],
  playedAs: GameHistorySummaryDto['playedAs'],
): string {
  if (result === 'draw') return '½–½';
  if (result === null) return '—';
  const whiteWon = (result === 'win') === (playedAs === 'white');
  return whiteWon ? '1–0' : '0–1';
}

function resultChipClass(r: 'win' | 'loss' | 'draw'): string {
  if (r === 'win') return 'text-success bg-success/10 border-success/25';
  if (r === 'loss') return 'text-destructive bg-destructive/10 border-destructive/25';
  return 'text-muted-foreground bg-raised/60 border-border/70';
}

function resultDotClass(r: 'win' | 'loss' | 'draw'): string {
  if (r === 'win') return 'bg-success';
  if (r === 'loss') return 'bg-destructive';
  return 'bg-muted-foreground';
}

export const GameHistoryRow = forwardRef<HTMLTableRowElement, GameHistoryRowProps>(
  function GameHistoryRow({ game, style, ...rest }, ref) {
    const router = useRouter();
    const tc = formatTimeControl(game.timeControlSeconds, game.incrementSeconds);
    const date = game.endedAt
      ? new Date(game.endedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '—';
    const deltaSign = game.ratingDelta !== null && game.ratingDelta > 0 ? '+' : '';
    const deltaStr = game.ratingDelta !== null ? `${deltaSign}${game.ratingDelta}` : '—';
    const score = scoreNotation(game.result, game.playedAs);

    return (
      <tr
        ref={ref}
        style={style}
        {...rest}
        data-testid="game-row"
        onClick={(e) => {
          // Don't hijack modified clicks (open-in-new-tab etc.), non-primary
          // buttons, or clicks that are part of a text selection.
          if (
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey ||
            e.button !== 0 ||
            window.getSelection()?.toString()
          ) {
            return;
          }
          router.push(`/games/${game.id}`);
        }}
        className="group cursor-pointer border-b border-border/40 last:border-b-0 transition-colors hover:bg-raised/40 hover:shadow-[inset_2px_0_0_hsl(var(--brass)/0.55)] focus-within:bg-raised/40"
      >
        <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">
          {date}
        </td>
        <td className="px-4 py-2.5 text-sm font-medium">
          <span className="inline-flex items-center gap-2">
            {game.opponentUsername}
            {game.isVsComputer && (
              <span className="rounded border border-brass/25 bg-brass/10 px-1 py-0.5 font-mono text-[10px] uppercase tracking-wide text-brass-text">
                Computer
              </span>
            )}
          </span>
        </td>
        <td className="px-4 py-2.5 text-center">
          <span
            role="img"
            aria-label={game.playedAs}
            className={cn(
              'inline-block h-3 w-3 rounded-[3px] align-middle ring-1 ring-inset ring-border',
              // Fixed neutral side colors, independent of the board-theme picker.
              game.playedAs === 'white' ? 'bg-[#f1eee6]' : 'bg-[#26292b]',
            )}
          />
        </td>
        <td className="px-4 py-2.5">
          {game.result === null ? (
            <span className="font-mono text-[11px] text-muted-foreground">—</span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[11px] tabular-nums',
                resultChipClass(game.result),
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-full', resultDotClass(game.result))}
                aria-hidden
              />
              {score}
              <span className="sr-only">{resultLabel(game.result)}</span>
            </span>
          )}
        </td>
        <td
          className={cn(
            'px-4 py-2.5 text-right font-mono text-sm tabular-nums',
            game.ratingDelta !== null && game.ratingDelta > 0 && 'text-success',
            game.ratingDelta !== null && game.ratingDelta < 0 && 'text-destructive',
            (game.ratingDelta === null || game.ratingDelta === 0) && 'text-muted-foreground',
          )}
        >
          {deltaStr}
        </td>
        <td className="px-4 py-2.5 font-mono text-sm tabular-nums text-muted-foreground">{tc}</td>
        <td className="px-4 py-2.5 text-right text-sm">
          <Link
            href={`/games/${game.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-brass group-hover:text-brass"
          >
            Review
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </td>
      </tr>
    );
  },
);

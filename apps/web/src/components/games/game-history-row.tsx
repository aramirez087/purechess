import Link from 'next/link';
import { cn, formatTimeControl } from '@/lib/utils';
import { Crown, Shield, TrendingDown, TrendingUp, Minus, ArrowUpRight } from 'lucide-react';
import type { GameHistorySummaryDto } from '@purechess/shared';

type GameHistoryRowProps = {
  game: GameHistorySummaryDto;
};

function resultLabel(r: GameHistorySummaryDto['result']): string {
  if (r === 'win') return 'Win';
  if (r === 'loss') return 'Loss';
  if (r === 'draw') return 'Draw';
  return '—';
}

function resultClass(r: GameHistorySummaryDto['result']): string {
  if (r === 'win') return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (r === 'loss') return 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20';
  return 'text-muted-foreground bg-raised border-border/70';
}

export function GameHistoryRow({ game }: GameHistoryRowProps) {
  const tc = formatTimeControl(game.timeControlSeconds, game.incrementSeconds);
  const date = game.endedAt
    ? new Date(game.endedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '—';
  const deltaSign = game.ratingDelta !== null && game.ratingDelta > 0 ? '+' : '';
  const deltaStr = game.ratingDelta !== null ? `${deltaSign}${game.ratingDelta}` : '—';

  const ColorIcon = game.playedAs === 'white' ? Crown : Shield;
  const DeltaIcon =
    game.ratingDelta === null
      ? Minus
      : game.ratingDelta > 0
        ? TrendingUp
        : game.ratingDelta < 0
          ? TrendingDown
          : Minus;

  return (
    <tr className="border-b border-border/40 transition-colors hover:bg-raised/40">
      <td className="px-4 py-2.5 text-sm text-muted-foreground tabular-nums">{date}</td>
      <td className="px-4 py-2.5 text-sm font-medium">
        <span className="inline-flex items-center gap-2">
          <span
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded ring-1 ring-inset',
              game.playedAs === 'white'
                ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-900/40'
                : 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:ring-slate-800',
            )}
            aria-label={game.playedAs}
          >
            <ColorIcon className="h-2.5 w-2.5" />
          </span>
          {game.opponentUsername}
          {game.isVsComputer && (
            <span className="ml-1 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-[#d6b563]/10 text-[#d6b563] border border-[#d6b563]/20">
              Computer
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-2.5 text-center">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {game.playedAs}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
            resultClass(game.result),
          )}
        >
          <DeltaIcon className="h-3 w-3" />
          {resultLabel(game.result)}
        </span>
      </td>
      <td
        className={cn(
          'px-4 py-2.5 text-sm font-mono tabular-nums text-right',
          game.ratingDelta !== null && game.ratingDelta > 0 && 'text-emerald-600 dark:text-emerald-400',
          game.ratingDelta !== null && game.ratingDelta < 0 && 'text-rose-600 dark:text-rose-400',
          (game.ratingDelta === null || game.ratingDelta === 0) && 'text-muted-foreground',
        )}
      >
        {deltaStr}
      </td>
      <td className="px-4 py-2.5 text-sm font-mono text-muted-foreground tabular-nums">{tc}</td>
      <td className="px-4 py-2.5 text-sm text-right">
        <Link
          href={`/games/${game.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Review
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </td>
    </tr>
  );
}

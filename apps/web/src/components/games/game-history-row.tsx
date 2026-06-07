import Link from 'next/link';
import { cn, formatTimeControl } from '@/lib/utils';
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
  if (r === 'win') return 'text-green-600 dark:text-green-400';
  if (r === 'loss') return 'text-destructive';
  return 'text-muted-foreground';
}

export function GameHistoryRow({ game }: GameHistoryRowProps) {
  const tc = formatTimeControl(game.timeControlSeconds, game.incrementSeconds);
  const date = game.endedAt ? new Date(game.endedAt).toLocaleDateString() : '—';
  const deltaSign = game.ratingDelta !== null && game.ratingDelta > 0 ? '+' : '';
  const deltaStr = game.ratingDelta !== null ? `${deltaSign}${game.ratingDelta}` : '—';

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2.5 text-sm text-muted-foreground tabular-nums">{date}</td>
      <td className="px-4 py-2.5 text-sm">{game.opponentUsername}</td>
      <td className="px-4 py-2.5 text-sm font-mono text-center">
        {game.playedAs === 'white' ? '♔' : '♚'}
      </td>
      <td className={cn('px-4 py-2.5 text-sm font-medium', resultClass(game.result))}>
        {resultLabel(game.result)}
      </td>
      <td
        className={cn(
          'px-4 py-2.5 text-sm font-mono tabular-nums text-right',
          game.ratingDelta !== null && game.ratingDelta > 0 && 'text-green-600 dark:text-green-400',
          game.ratingDelta !== null && game.ratingDelta < 0 && 'text-destructive',
          (game.ratingDelta === null || game.ratingDelta === 0) && 'text-muted-foreground',
        )}
      >
        {deltaStr}
      </td>
      <td className="px-4 py-2.5 text-sm font-mono text-muted-foreground">{tc}</td>
      <td className="px-4 py-2.5 text-sm">
        <Link
          href={`/games/${game.id}`}
          className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Review
        </Link>
      </td>
    </tr>
  );
}

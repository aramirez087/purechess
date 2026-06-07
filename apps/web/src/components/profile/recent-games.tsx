import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatTimeControl } from '@/lib/utils';
import type { GameHistorySummaryDto } from '@purechess/shared';

type RecentGamesProps = {
  games: GameHistorySummaryDto[];
};

function ResultBadge({ result }: { result: GameHistorySummaryDto['result'] }) {
  if (!result) return <Badge variant="secondary">—</Badge>;
  return (
    <Badge
      variant="secondary"
      className={cn(
        result === 'win' && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        result === 'loss' && 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        result === 'draw' && 'bg-muted text-muted-foreground',
      )}
    >
      {result === 'win' ? 'Win' : result === 'loss' ? 'Loss' : 'Draw'}
    </Badge>
  );
}

function RatingDelta({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-muted-foreground">—</span>;
  const sign = delta > 0 ? '+' : '';
  return (
    <span
      className={cn(
        'font-mono tabular-nums text-sm',
        delta > 0 && 'text-green-600 dark:text-green-400',
        delta < 0 && 'text-destructive',
        delta === 0 && 'text-muted-foreground',
      )}
    >
      {sign}{delta}
    </span>
  );
}

export function RecentGames({ games }: RecentGamesProps) {
  if (games.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No recent games.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Recent Games
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul>
          {games.map((g, i) => (
            <li
              key={g.id}
              className={cn(
                'border-b border-border last:border-0',
                i === 0 && 'rounded-t-none',
              )}
            >
              <Link
                href={`/games/${g.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate">{g.opponentUsername}</span>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 text-xs font-mono"
                >
                  {g.playedAs === 'white' ? '♔' : '♚'}
                </Badge>
                <ResultBadge result={g.result} />
                <RatingDelta delta={g.ratingDelta} />
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {formatTimeControl(g.timeControlSeconds, g.incrementSeconds)}
                </span>
                {g.endedAt && (
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                    {new Date(g.endedAt).toLocaleDateString()}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

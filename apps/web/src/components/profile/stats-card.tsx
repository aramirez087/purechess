import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StatsDto } from '@purechess/shared';

type StatsCardProps = {
  stats: StatsDto;
};

export function StatsCard({ stats }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2 text-center">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Games</span>
            <span className="text-lg font-mono font-semibold tabular-nums">{stats.totalGames}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Wins</span>
            <span className="text-lg font-mono font-semibold tabular-nums text-green-600 dark:text-green-400">
              {stats.wins}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Losses</span>
            <span className="text-lg font-mono font-semibold tabular-nums text-destructive">
              {stats.losses}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Draws</span>
            <span className="text-lg font-mono font-semibold tabular-nums">{stats.draws}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Win%</span>
            <span className="text-lg font-mono font-semibold tabular-nums">
              {stats.winRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn, formatTimeControl } from '@/lib/utils';
import type { GameHistorySummaryDto } from '@purechess/shared';
import { Clock, Crown, Shield, TrendingDown, TrendingUp, Minus, ArrowUpRight } from 'lucide-react';

type RecentGamesProps = {
  games: GameHistorySummaryDto[];
};

function ResultBadge({ result }: { result: GameHistorySummaryDto['result'] }) {
  if (!result) return null;
  const map = {
    win: {
      label: 'Win',
      classes: 'bg-success/10 text-success border-success/25',
      icon: TrendingUp,
    },
    loss: {
      label: 'Loss',
      classes: 'bg-destructive/10 text-destructive border-destructive/25',
      icon: TrendingDown,
    },
    draw: {
      label: 'Draw',
      classes: 'bg-raised text-muted-foreground border-border/70',
      icon: Minus,
    },
  } as const;
  const cfg = map[result];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        cfg.classes,
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function RatingDelta({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-muted-foreground/60">—</span>;
  const sign = delta > 0 ? '+' : '';
  const color =
    delta > 0
      ? 'text-success'
      : delta < 0
        ? 'text-destructive'
        : 'text-muted-foreground';
  return (
    <span className={cn('font-mono tabular-nums text-sm font-medium', color)}>
      {sign}
      {delta}
    </span>
  );
}

export function RecentGames({ games }: RecentGamesProps) {
  if (games.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border/70 bg-surface/40 p-8 text-center">
        <p className="text-sm text-muted-foreground">No recent games yet.</p>
        <Link
          href="/play"
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brass hover:underline"
        >
          Start your first game
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border/70 bg-surface/60 shadow-elevated">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Recent games
        </h2>
        <Link
          href="/games"
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          See all →
        </Link>
      </header>
      <ul className="divide-y divide-border/60">
        {games.map((g) => {
          const ColorIcon = g.playedAs === 'white' ? Crown : Shield;
          const date = g.endedAt
            ? new Date(g.endedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })
            : '—';
          return (
            <li key={g.id}>
              <Link
                href={`/games/${g.id}`}
                className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-raised/60"
              >
                <span
                  role="img"
                  className={cn(
                    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset',
                    g.playedAs === 'white'
                      ? 'bg-foreground/90 text-background ring-border'
                      : 'bg-raised text-muted-foreground ring-border',
                  )}
                  aria-label={`Played as ${g.playedAs}`}
                >
                  <ColorIcon className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{g.opponentUsername}</p>
                  {/* div, not p: Badge renders a <div> and divs inside <p> break hydration (bug-224) */}
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {formatTimeControl(g.timeControlSeconds, g.incrementSeconds)}
                    </span>
                    {g.isRated && <Badge variant="outline" className="h-4 px-1.5 text-[9px]">Rated</Badge>}
                  </div>
                </div>
                <div className="hidden text-xs text-muted-foreground sm:block tabular-nums">
                  {date}
                </div>
                <ResultBadge result={g.result} />
                <div className="w-12 text-right">
                  <RatingDelta delta={g.ratingDelta} />
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

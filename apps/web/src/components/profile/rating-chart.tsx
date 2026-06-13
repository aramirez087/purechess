'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { RatingHistoryPoint } from '@purechess/shared';
import {
  computeChartLayout,
  LineRatingChart,
  ChartTooltip,
  dayFmt,
} from '../charts/line-rating-chart';

interface RatingChartProps {
  history: RatingHistoryPoint[]; // all categories combined
  className?: string;
}

type Category = 'bullet' | 'blitz' | 'rapid';
type TimeRange = '1m' | '3m' | '1y' | 'all';

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'bullet', label: 'Bullet' },
  { value: 'blitz', label: 'Blitz' },
  { value: 'rapid', label: 'Rapid' },
];

const RANGES: { value: TimeRange; label: string; days: number | null }[] = [
  { value: '1m', label: '1m', days: 30 },
  { value: '3m', label: '3m', days: 90 },
  { value: '1y', label: '1y', days: 365 },
  { value: 'all', label: 'All', days: null },
];

function dotColor(delta: number): string {
  if (delta > 0) return '#22c55e';
  if (delta < 0) return '#ef4444';
  return 'hsl(var(--muted-foreground))';
}

export function RatingChart({ history, className }: RatingChartProps) {
  const [activeCategory, setActiveCategory] = useState<Category>(() => {
    let best: Category = 'blitz';
    let bestCount = -1;
    for (const cat of CATEGORIES) {
      const count = history.filter((p) => p.category === cat.value).length;
      if (count > bestCount) {
        best = cat.value;
        bestCount = count;
      }
    }
    return best;
  });
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const visibleCategories = useMemo(
    () => CATEGORIES.filter((cat) => history.some((p) => p.category === cat.value)),
    [history],
  );

  const points = useMemo(() => {
    const days = RANGES.find((r) => r.value === timeRange)?.days ?? null;
    const cutoff = days === null ? null : Date.now() - days * 86_400_000;
    return history.filter(
      (p) =>
        p.category === activeCategory &&
        (cutoff === null || new Date(p.playedAt).getTime() >= cutoff),
    );
  }, [history, activeCategory, timeRange]);

  const layout = useMemo(
    () =>
      computeChartLayout(
        points.map((p) => p.ratingAfter),
        points.map((p) => new Date(p.playedAt).getTime()),
      ),
    [points],
  );

  const hovered = hoverIdx !== null && layout ? points[hoverIdx] : null;
  const hoveredCoord = hoverIdx !== null && layout ? layout.coords[hoverIdx] : null;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex gap-1" role="tablist" aria-label="Rating category">
          {visibleCategories.map((cat) => (
            <button
              key={cat.value}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat.value}
              onClick={() => {
                setActiveCategory(cat.value);
                setHoverIdx(null);
              }}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                activeCategory === cat.value
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {RANGES.map((range) => (
            <button
              key={range.value}
              type="button"
              aria-pressed={timeRange === range.value}
              onClick={() => {
                setTimeRange(range.value);
                setHoverIdx(null);
              }}
              className={cn(
                'rounded px-2 py-1 text-[11px] font-medium tabular-nums transition-colors',
                timeRange === range.value
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {!layout ? (
        <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
          Not enough games yet
        </div>
      ) : (
        <div className="relative">
          <LineRatingChart
            layout={layout}
            ariaLabel={`${activeCategory} rating over time`}
            hoverIdx={hoverIdx}
            onHover={setHoverIdx}
            dotFill={(i) => dotColor(points[i].ratingDelta)}
            dotTestId="rating-dot"
            hitTestId="rating-hit"
          />

          {hovered && hoveredCoord && (
            <ChartTooltip coordX={hoveredCoord.x} coordY={hoveredCoord.y} pointerEvents="auto">
              <div className="text-muted-foreground">
                {dayFmt.format(new Date(hovered.playedAt))}
              </div>
              <div
                className={cn(
                  'font-mono font-semibold tabular-nums',
                  hovered.ratingDelta > 0 && 'text-green-500',
                  hovered.ratingDelta < 0 && 'text-red-500',
                )}
              >
                {hovered.ratingDelta > 0 ? `+${hovered.ratingDelta}` : hovered.ratingDelta} pts
              </div>
              <div className="font-mono tabular-nums">→ {hovered.ratingAfter}</div>
              {hovered.gameId && (
                <Link
                  href={`/games/${hovered.gameId}`}
                  className="mt-1 inline-block text-[11px] text-primary underline-offset-2 hover:underline"
                >
                  View game
                </Link>
              )}
            </ChartTooltip>
          )}
        </div>
      )}
    </div>
  );
}

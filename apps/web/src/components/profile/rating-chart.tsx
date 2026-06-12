'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { RatingHistoryPoint } from '@purechess/shared';

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

// viewBox geometry — responsive via preserveAspectRatio, never a fixed pixel width.
const VB_W = 500;
const VB_H = 120;
const PLOT = { x0: 40, x1: VB_W - 12, y0: 12, y1: VB_H - 20 };

const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

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

  const layout = useMemo(() => {
    if (points.length < 2) return null;
    const ratings = points.map((p) => p.ratingAfter);
    const minRating = Math.min(...ratings) - 20;
    const maxRating = Math.max(...ratings) + 20;
    const toY = (rating: number) =>
      PLOT.y1 - ((rating - minRating) / (maxRating - minRating)) * (PLOT.y1 - PLOT.y0);
    const toX = (i: number) => PLOT.x0 + (i / (points.length - 1)) * (PLOT.x1 - PLOT.x0);
    const coords = points.map((p, i) => ({ x: toX(i), y: toY(p.ratingAfter) }));

    const midRating = Math.round((minRating + maxRating) / 2);
    const gridlines = [minRating, midRating, maxRating].map((rating) => ({
      rating,
      y: toY(rating),
    }));

    const labelCount = Math.min(4, points.length);
    const xLabels = Array.from({ length: labelCount }, (_, k) => {
      const i = Math.round((k / (labelCount - 1)) * (points.length - 1));
      return { x: toX(i), text: monthFmt.format(new Date(points[i].playedAt)) };
    });

    return { coords, gridlines, xLabels };
  }, [points]);

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
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            width="100%"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`${activeCategory} rating over time`}
          >
            {layout.gridlines.map((line) => (
              <g key={line.rating}>
                <line
                  x1={PLOT.x0}
                  x2={PLOT.x1}
                  y1={line.y}
                  y2={line.y}
                  stroke="hsl(var(--border))"
                  strokeDasharray="2 4"
                  opacity={0.6}
                />
                <text
                  x={PLOT.x0 - 6}
                  y={line.y + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill="hsl(var(--muted-foreground))"
                  className="font-mono tabular-nums"
                >
                  {line.rating}
                </text>
              </g>
            ))}

            {layout.xLabels.map((label, k) => (
              <text
                key={k}
                x={label.x}
                y={VB_H - 6}
                textAnchor="middle"
                fontSize={9}
                fill="hsl(var(--muted-foreground))"
                className="font-mono"
              >
                {label.text}
              </text>
            ))}

            <polyline
              points={layout.coords.map((c) => `${c.x},${c.y}`).join(' ')}
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              fill="none"
            />

            {layout.coords.map((c, i) => (
              <g key={i}>
                {hoverIdx === i && (
                  <circle cx={c.x} cy={c.y} r={6} fill="hsl(var(--primary))" opacity={0.25} />
                )}
                <circle
                  data-testid="rating-dot"
                  cx={c.x}
                  cy={c.y}
                  r={hoverIdx === i ? 4 : 2.5}
                  fill={dotColor(points[i].ratingDelta)}
                  stroke={hoverIdx === i ? 'hsl(var(--primary))' : 'none'}
                  strokeWidth={1}
                />
              </g>
            ))}

            {/* Invisible hit targets — reliable hover regardless of dot size */}
            {layout.coords.map((c, i) => (
              <rect
                key={i}
                data-testid="rating-hit"
                x={c.x - 6}
                y={0}
                width={12}
                height={VB_H}
                fill="transparent"
                onPointerEnter={() => setHoverIdx(i)}
                onPointerLeave={() => setHoverIdx(null)}
              />
            ))}
          </svg>

          {hovered && hoveredCoord && (
            <div
              className="pointer-events-auto absolute z-10 min-w-[100px] rounded-md border border-border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md"
              style={{
                left: `${Math.min(82, Math.max(10, (hoveredCoord.x / VB_W) * 100))}%`,
                top: `${(hoveredCoord.y / VB_H) * 100}%`,
                transform: 'translate(-50%, -112%)',
              }}
            >
              <div className="text-muted-foreground">{dayFmt.format(new Date(hovered.playedAt))}</div>
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

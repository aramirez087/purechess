'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { PuzzleRatingPointDto } from '@purechess/shared';

/**
 * Puzzle-rating curve over time. Reuses the profile rating-chart's visual
 * language verbatim — same pure-SVG approach (no chart lib), same brass line
 * (`hsl(var(--primary))`), same dashed gridlines, x/y axis labels, and hover
 * tooltip. A single series (the user's puzzle Glicko after each attempt /
 * daily-close bucket), so no category/range tabs. Below ~2 points it shows the
 * "solve more puzzles" empty state rather than a degenerate line.
 */

interface PuzzleRatingChartProps {
  history: PuzzleRatingPointDto[];
  className?: string;
}

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

const EMPTY_COPY = 'Solve ~20 puzzles to start your rating curve';

export function PuzzleRatingChart({ history, className }: PuzzleRatingChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const layout = useMemo(() => {
    if (history.length < 2) return null;
    const ratings = history.map((p) => p.rating);
    const minRating = Math.min(...ratings) - 20;
    const maxRating = Math.max(...ratings) + 20;
    const span = maxRating - minRating || 1;
    const toY = (rating: number) => PLOT.y1 - ((rating - minRating) / span) * (PLOT.y1 - PLOT.y0);
    const toX = (i: number) => PLOT.x0 + (i / (history.length - 1)) * (PLOT.x1 - PLOT.x0);
    const coords = history.map((p, i) => ({ x: toX(i), y: toY(p.rating) }));

    const midRating = Math.round((minRating + maxRating) / 2);
    const gridlines = [minRating, midRating, maxRating].map((rating) => ({
      rating: Math.round(rating),
      y: toY(rating),
    }));

    const labelCount = Math.min(4, history.length);
    const xLabels = Array.from({ length: labelCount }, (_, k) => {
      const i = Math.round((k / Math.max(1, labelCount - 1)) * (history.length - 1));
      return { x: toX(i), text: monthFmt.format(new Date(history[i].at)) };
    });

    return { coords, gridlines, xLabels };
  }, [history]);

  // Text-equivalent summary for screen readers: SVG charts are otherwise
  // opaque. States the span, the endpoints, and the net direction.
  const summary = useMemo(() => {
    if (history.length < 2) return EMPTY_COPY;
    const first = history[0].rating;
    const last = history[history.length - 1].rating;
    const lo = Math.min(...history.map((p) => p.rating));
    const hi = Math.max(...history.map((p) => p.rating));
    const net = last - first;
    const dir = net > 0 ? `up ${net}` : net < 0 ? `down ${-net}` : 'flat';
    return `Puzzle rating over ${history.length} points: ${first} to ${last} (${dir}). Low ${lo}, high ${hi}.`;
  }, [history]);

  const hovered = hoverIdx !== null && layout ? history[hoverIdx] : null;
  const hoveredCoord = hoverIdx !== null && layout ? layout.coords[hoverIdx] : null;
  const delta =
    hovered && hoverIdx !== null && hoverIdx > 0
      ? hovered.rating - history[hoverIdx - 1].rating
      : 0;

  if (!layout) {
    return (
      <div
        data-testid="puzzle-rating-chart-empty"
        className={cn(
          'flex h-[120px] items-center justify-center rounded-[10px] border border-dashed border-border/70 px-6 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        {EMPTY_COPY}
      </div>
    );
  }

  return (
    <div className={className} data-testid="puzzle-rating-chart">
      <div className="relative">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={summary}
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
                data-testid="puzzle-rating-dot"
                cx={c.x}
                cy={c.y}
                r={hoverIdx === i ? 4 : 2.5}
                fill="hsl(var(--primary))"
                stroke={hoverIdx === i ? 'hsl(var(--primary))' : 'none'}
                strokeWidth={1}
              />
            </g>
          ))}

          {/* Invisible hit targets — reliable hover regardless of dot size */}
          {layout.coords.map((c, i) => (
            <rect
              key={i}
              data-testid="puzzle-rating-hit"
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
            className="pointer-events-none absolute z-10 min-w-[100px] rounded-md border border-border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md"
            style={{
              left: `${Math.min(82, Math.max(10, (hoveredCoord.x / VB_W) * 100))}%`,
              top: `${(hoveredCoord.y / VB_H) * 100}%`,
              transform: 'translate(-50%, -112%)',
            }}
          >
            <div className="text-muted-foreground">{dayFmt.format(new Date(hovered.at))}</div>
            <div className="font-mono font-semibold tabular-nums">{hovered.rating}</div>
            {delta !== 0 && (
              <div
                className={cn(
                  'font-mono tabular-nums',
                  delta > 0 && 'text-green-500',
                  delta < 0 && 'text-red-500',
                )}
              >
                {delta > 0 ? `+${delta}` : delta} pts
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const VB_W = 500;
export const VB_H = 120;
export const PLOT = { x0: 40, x1: VB_W - 12, y0: 12, y1: VB_H - 20 };

export const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });
export const dayFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export interface ChartCoord {
  x: number;
  y: number;
}
export interface ChartGridline {
  rating: number;
  y: number;
}
export interface ChartXLabel {
  x: number;
  text: string;
}
export interface ChartLayout {
  coords: ChartCoord[];
  gridlines: ChartGridline[];
  xLabels: ChartXLabel[];
}

/**
 * ratings[i] and timestamps[i] must be parallel arrays (same length, same index).
 * Returns null when fewer than 2 points.
 */
export function computeChartLayout(
  ratings: number[],
  timestamps: number[],
): ChartLayout | null {
  const n = ratings.length;
  if (n < 2) return null;

  const minRating = Math.min(...ratings) - 20;
  const maxRating = Math.max(...ratings) + 20;
  const span = maxRating - minRating || 1;
  const toY = (r: number) => PLOT.y1 - ((r - minRating) / span) * (PLOT.y1 - PLOT.y0);
  const toX = (i: number) => PLOT.x0 + (i / (n - 1)) * (PLOT.x1 - PLOT.x0);

  const coords = ratings.map((r, i) => ({ x: toX(i), y: toY(r) }));

  const midRating = Math.round((minRating + maxRating) / 2);
  const gridlines = [minRating, midRating, maxRating].map((r) => ({
    rating: Math.round(r),
    y: toY(r),
  }));

  const labelCount = Math.min(4, n);
  const xLabels = Array.from({ length: labelCount }, (_, k) => {
    const i = Math.round((k / Math.max(1, labelCount - 1)) * (n - 1));
    return { x: toX(i), text: monthFmt.format(new Date(timestamps[i])) };
  });

  return { coords, gridlines, xLabels };
}

interface LineRatingChartProps {
  layout: ChartLayout;
  ariaLabel: string;
  hoverIdx: number | null;
  onHover: (idx: number | null) => void;
  dotFill: (i: number) => string;
  dotTestId: string;
  hitTestId: string;
}

export function LineRatingChart({
  layout,
  ariaLabel,
  hoverIdx,
  onHover,
  dotFill,
  dotTestId,
  hitTestId,
}: LineRatingChartProps) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel}
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
            data-testid={dotTestId}
            cx={c.x}
            cy={c.y}
            r={hoverIdx === i ? 4 : 2.5}
            fill={dotFill(i)}
            stroke={hoverIdx === i ? 'hsl(var(--primary))' : 'none'}
            strokeWidth={1}
          />
        </g>
      ))}

      {/* Invisible hit targets — reliable hover regardless of dot size */}
      {layout.coords.map((c, i) => (
        <rect
          key={i}
          data-testid={hitTestId}
          x={c.x - 6}
          y={0}
          width={12}
          height={VB_H}
          fill="transparent"
          onPointerEnter={() => onHover(i)}
          onPointerLeave={() => onHover(null)}
        />
      ))}
    </svg>
  );
}

interface ChartTooltipProps {
  coordX: number;
  coordY: number;
  pointerEvents?: 'auto' | 'none';
  children: ReactNode;
}

export function ChartTooltip({
  coordX,
  coordY,
  pointerEvents = 'none',
  children,
}: ChartTooltipProps) {
  return (
    <div
      className={cn(
        'absolute z-10 min-w-[100px] rounded-md border border-border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md',
        pointerEvents === 'auto' ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      style={{
        left: `${Math.min(82, Math.max(10, (coordX / VB_W) * 100))}%`,
        top: `${(coordY / VB_H) * 100}%`,
        transform: 'translate(-50%, -112%)',
      }}
    >
      {children}
    </div>
  );
}

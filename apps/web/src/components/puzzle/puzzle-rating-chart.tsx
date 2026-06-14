'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { PuzzleRatingPointDto } from '@purechess/shared';
import {
  computeChartLayout,
  LineRatingChart,
  ChartTooltip,
  dayFmt,
} from '../charts/line-rating-chart';

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

const EMPTY_COPY = 'Solve ~20 puzzles to start your rating curve';

export function PuzzleRatingChart({ history, className }: PuzzleRatingChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const layout = useMemo(
    () =>
      computeChartLayout(
        history.map((p) => p.rating),
        history.map((p) => new Date(p.at).getTime()),
      ),
    [history],
  );

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
        <LineRatingChart
          layout={layout}
          ariaLabel={summary}
          hoverIdx={hoverIdx}
          onHover={setHoverIdx}
          dotFill={() => 'hsl(var(--primary))'}
          dotTestId="puzzle-rating-dot"
          hitTestId="puzzle-rating-hit"
        />

        {hovered && hoveredCoord && (
          <ChartTooltip coordX={hoveredCoord.x} coordY={hoveredCoord.y} pointerEvents="none">
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
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}

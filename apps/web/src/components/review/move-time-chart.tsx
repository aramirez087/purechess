'use client';

import { useState } from 'react';
import type { WireMove } from '@purechess/shared';
import type { ClassifiedMove, MoveClass } from '@/hooks/use-move-classifier';
import { cn } from '@/lib/utils';

/** Real thinking threshold — pre-moves and instant book moves sit under this. */
const MIN_THINK_MS = 500;
/** A single long think must not collapse every other bar to a sliver. */
const CAP_MS = 60_000;

const VIEW_W = 500;
const VIEW_H = 80;

const BAR_COLORS: Record<MoveClass | 'unclassified', string> = {
  brilliant: '#10b981',
  best: '#22c55e',
  good: 'hsl(var(--muted-foreground))',
  forced: 'hsl(var(--muted-foreground))',
  inaccuracy: '#eab308',
  mistake: '#f97316',
  blunder: '#ef4444',
  unclassified: 'hsl(var(--border))',
};

interface MoveTimeChartProps {
  moves: WireMove[];
  /** Index-aligned with `moves`; bars fall back to neutral when absent. */
  classifications?: ClassifiedMove[];
  currentPly: number;
  onSeek: (ply: number) => void;
  className?: string;
}

function moveLabel(m: WireMove): string {
  const moveNo = Math.ceil(m.ply / 2);
  return `${moveNo}${m.by === 'w' ? '.' : '…'} ${m.san}`;
}

function avgSeconds(moves: WireMove[], by: 'w' | 'b'): string | null {
  const thought = moves.filter((m) => m.by === by && (m.moveTimeMs ?? 0) > MIN_THINK_MS);
  if (thought.length === 0) return null;
  const avg = thought.reduce((sum, m) => sum + m.moveTimeMs, 0) / thought.length;
  return `${(avg / 1000).toFixed(1)}s`;
}

/**
 * Per-ply move-time bars, colored by the move's classification when one is
 * available. Click a bar to seek to that position. Renders nothing for games
 * with no real thinking time (every move under {@link MIN_THINK_MS}).
 */
export function MoveTimeChart({
  moves,
  classifications,
  currentPly,
  onSeek,
  className,
}: MoveTimeChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (moves.length === 0 || !moves.some((m) => (m.moveTimeMs ?? 0) > MIN_THINK_MS)) {
    return null;
  }

  const times = moves.map((m) => Math.min(m.moveTimeMs ?? 0, CAP_MS));
  const maxMs = Math.max(...times);
  const colWidth = VIEW_W / moves.length;
  const barWidth = Math.min(colWidth * 0.7, 14);
  const xCenter = (i: number) => colWidth * i + colWidth / 2;

  const indexFromEvent = (
    e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const ratio = (e.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(moves.length - 1, Math.floor(ratio * moves.length)));
  };

  const hovered = hoverIndex !== null ? moves[hoverIndex] : undefined;
  const whiteAvg = avgSeconds(moves, 'w');
  const blackAvg = avgSeconds(moves, 'b');

  return (
    <div className={className}>
      <svg
        role="img"
        aria-label="Move times"
        width="100%"
        height={48}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="block cursor-pointer touch-none"
        onPointerMove={(e) => setHoverIndex(indexFromEvent(e))}
        onPointerLeave={() => setHoverIndex(null)}
        onClick={(e) => {
          const i = indexFromEvent(e);
          if (i !== null) onSeek(i + 1);
        }}
      >
        {hovered !== undefined && (
          <title>{`${moveLabel(hovered)} — ${((hovered.moveTimeMs ?? 0) / 1000).toFixed(1)}s`}</title>
        )}
        <line
          x1="0"
          y1={VIEW_H}
          x2={VIEW_W}
          y2={VIEW_H}
          stroke="hsl(var(--border))"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {moves.map((m, i) => {
          const h = maxMs > 0 ? (times[i] / maxMs) * (VIEW_H - 4) : 0;
          return (
            <rect
              key={m.ply}
              data-ply={m.ply}
              x={xCenter(i) - barWidth / 2}
              y={VIEW_H - h}
              width={barWidth}
              height={h}
              fill={BAR_COLORS[classifications?.[i]?.class ?? 'unclassified']}
              opacity={m.by === 'w' ? 1 : 0.6}
            />
          );
        })}
        {currentPly >= 1 && currentPly <= moves.length && (
          <line
            x1={xCenter(currentPly - 1)}
            y1="0"
            x2={xCenter(currentPly - 1)}
            y2={VIEW_H}
            stroke="hsl(var(--primary))"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {(whiteAvg || blackAvg) && (
        <div
          className={cn(
            'mt-1 flex items-center font-mono text-[11px] tabular-nums text-[#9da79c]',
            whiteAvg && blackAvg ? 'justify-between' : 'justify-start',
          )}
        >
          {whiteAvg && <span>White avg: {whiteAvg}</span>}
          {blackAvg && <span>Black avg: {blackAvg}</span>}
        </div>
      )}
    </div>
  );
}

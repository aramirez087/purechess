'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

const CLAMP_CP = 600;

interface EvalGraphProps {
  /** White-POV cp, index 0 = start position. */
  evals: number[];
  currentPly: number;
  onSeek: (ply: number) => void;
  className?: string;
}

/** Map a White-POV cp to 0..100 SVG y (0 = top = White winning). */
function toY(cp: number): number {
  const clamped = Math.max(-CLAMP_CP, Math.min(CLAMP_CP, cp));
  return 50 - (clamped / CLAMP_CP) * 50;
}

function formatEval(cp: number): string {
  return `${cp > 0 ? '+' : ''}${(cp / 100).toFixed(1)}`;
}

/**
 * Interactive eval-history chart: white territory above the dashed center
 * line, black below. Click anywhere to seek to the nearest ply.
 */
export function EvalGraph({ evals, currentPly, onSeek, className }: EvalGraphProps) {
  const clipId = useId();
  const [hoverPly, setHoverPly] = useState<number | null>(null);

  const lastIndex = evals.length - 1;
  const xFor = (ply: number) => (lastIndex > 0 ? (ply / lastIndex) * 100 : 0);

  const plyFromEvent = (e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    if (lastIndex < 1) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const ratio = (e.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(lastIndex, Math.round(ratio * lastIndex)));
  };

  const linePoints = evals.map((cp, ply) => `${xFor(ply)},${toY(cp)}`).join(' ');
  // Same shape fills both territories — the half-height clips decide which
  // side of the center line each tint paints.
  const areaPoints = `0,50 ${linePoints} 100,50`;
  const hovered = hoverPly !== null ? evals[hoverPly] : undefined;

  return (
    <svg
      role="img"
      aria-label="Evaluation graph"
      width="100%"
      height={48}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn('block cursor-pointer touch-none', className)}
      onPointerMove={(e) => setHoverPly(plyFromEvent(e))}
      onPointerLeave={() => setHoverPly(null)}
      onClick={(e) => {
        const ply = plyFromEvent(e);
        if (ply !== null) onSeek(ply);
      }}
    >
      {hovered !== undefined && hoverPly !== null && (
        <title>{`Ply ${hoverPly}: ${formatEval(hovered)}`}</title>
      )}
      <defs>
        <clipPath id={`${clipId}-top`}>
          <rect x="0" y="0" width="100" height="50" />
        </clipPath>
        <clipPath id={`${clipId}-bottom`}>
          <rect x="0" y="50" width="100" height="50" />
        </clipPath>
      </defs>
      {evals.length > 1 && (
        <>
          <polygon
            points={areaPoints}
            fill="rgba(255,255,255,0.15)"
            clipPath={`url(#${clipId}-top)`}
          />
          <polygon
            points={areaPoints}
            fill="rgba(0,0,0,0.25)"
            clipPath={`url(#${clipId}-bottom)`}
          />
        </>
      )}
      <line
        x1="0"
        y1="50"
        x2="100"
        y2="50"
        stroke="hsl(var(--border))"
        strokeWidth={1}
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />
      {evals.length > 1 && (
        <polyline
          points={linePoints}
          fill="none"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {lastIndex > 0 && currentPly >= 0 && currentPly <= lastIndex && (
        <line
          x1={xFor(currentPly)}
          y1="0"
          x2={xFor(currentPly)}
          y2="100"
          stroke="hsl(var(--primary))"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

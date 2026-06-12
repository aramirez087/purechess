'use client';

import { useId } from 'react';
import type { Square } from '@purechess/shared';
import type { AnnotationColor, BoardShape } from '@/lib/board/annotations';
import type { Orientation } from '@/lib/board/types';
import { squareToIndices } from '@/lib/board/coords';

const COLORS: AnnotationColor[] = ['green', 'red', 'blue', 'yellow'];

const ARROW_STROKE = 0.15;
const CIRCLE_RADIUS = 0.44;
const CIRCLE_STROKE = 0.08;
/** Pull the line back from the dest center so the marker tip lands ~center. */
const HEAD_SHORTEN = 0.5;
/** Extra pull-back when several arrows share a dest, so heads don't overlap. */
const SHARED_DEST_SHORTEN = 0.2;

interface InProgressShape {
  from: Square;
  to: Square | null;
  color: AnnotationColor;
}

interface AnnotationLayerProps {
  /** User-drawn shapes. */
  shapes: BoardShape[];
  /** Externally driven shapes (e.g. engine best move) — render dimmer, below. */
  autoShapes?: BoardShape[];
  /** Live right-drag preview. */
  inProgress?: InProgressShape | null;
  orientation: Orientation;
}

function center(orientation: Orientation, sq: Square): [number, number] {
  const { fileIdx, rankIdx } = squareToIndices(orientation, sq);
  return [fileIdx + 0.5, rankIdx + 0.5];
}

function Arrow({
  from,
  to,
  color,
  orientation,
  markerPrefix,
  shorten,
}: {
  from: Square;
  to: Square;
  color: AnnotationColor;
  orientation: Orientation;
  markerPrefix: string;
  shorten: number;
}) {
  const [x1, y1] = center(orientation, from);
  const [x2, y2] = center(orientation, to);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const ex = x2 - (dx / len) * shorten;
  const ey = y2 - (dy / len) * shorten;
  return (
    <line
      x1={x1}
      y1={y1}
      x2={ex}
      y2={ey}
      stroke={`var(--annotation-${color})`}
      strokeWidth={ARROW_STROKE}
      strokeLinecap="round"
      markerEnd={`url(#${markerPrefix}-${color})`}
    />
  );
}

function Circle({
  square,
  color,
  orientation,
}: {
  square: Square;
  color: AnnotationColor;
  orientation: Orientation;
}) {
  const [cx, cy] = center(orientation, square);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={CIRCLE_RADIUS}
      fill="none"
      stroke={`var(--annotation-${color})`}
      strokeWidth={CIRCLE_STROKE}
    />
  );
}

/**
 * Arrow/circle annotation overlay. viewBox is 8×8 board units, so square
 * centers sit at (fileIdx + 0.5, rankIdx + 0.5) straight from
 * squareToIndices — no per-pixel math, the SVG scales with the board.
 * z-[25]: above resting pieces (z-20, chessground-style arrows-over-pieces),
 * below the animation layer's sliding pieces (z-30) and the drag ghost.
 */
export function AnnotationLayer({
  shapes,
  autoShapes = [],
  inProgress,
  orientation,
}: AnnotationLayerProps) {
  const uid = useId();
  const markerPrefix = `${uid}-arrowhead`;

  const previewArrow = inProgress && inProgress.to && inProgress.to !== inProgress.from;
  if (shapes.length === 0 && autoShapes.length === 0 && !inProgress) return null;

  // Arrows converging on one square shorten further so the heads stay legible.
  const destCounts = new Map<Square, number>();
  const allArrows = [...autoShapes, ...shapes];
  if (previewArrow && inProgress.to) {
    allArrows.push({
      type: 'arrow',
      from: inProgress.from,
      to: inProgress.to,
      color: inProgress.color,
    });
  }
  for (const s of allArrows) {
    if (s.type === 'arrow') destCounts.set(s.to, (destCounts.get(s.to) ?? 0) + 1);
  }
  const shortenFor = (to: Square) =>
    HEAD_SHORTEN + ((destCounts.get(to) ?? 0) > 1 ? SHARED_DEST_SHORTEN : 0);

  const renderShape = (s: BoardShape, key: string) =>
    s.type === 'arrow' ? (
      <Arrow
        key={key}
        from={s.from}
        to={s.to}
        color={s.color}
        orientation={orientation}
        markerPrefix={markerPrefix}
        shorten={shortenFor(s.to)}
      />
    ) : (
      <Circle key={key} square={s.square} color={s.color} orientation={orientation} />
    );

  return (
    <svg
      viewBox="0 0 8 8"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[25] h-full w-full"
    >
      <defs>
        {COLORS.map((color) => (
          <marker
            key={color}
            id={`${markerPrefix}-${color}`}
            viewBox="0 0 10 10"
            refX="2.5"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={`var(--annotation-${color})`} />
          </marker>
        ))}
      </defs>
      {autoShapes.length > 0 && (
        <g opacity={0.75}>{autoShapes.map((s, i) => renderShape(s, `auto-${i}`))}</g>
      )}
      {shapes.map((s, i) => renderShape(s, `user-${i}`))}
      {inProgress && (
        <g opacity={0.9}>
          {previewArrow && inProgress.to ? (
            <Arrow
              from={inProgress.from}
              to={inProgress.to}
              color={inProgress.color}
              orientation={orientation}
              markerPrefix={markerPrefix}
              shorten={shortenFor(inProgress.to)}
            />
          ) : (
            <Circle square={inProgress.from} color={inProgress.color} orientation={orientation} />
          )}
        </g>
      )}
    </svg>
  );
}

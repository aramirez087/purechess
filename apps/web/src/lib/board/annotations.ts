import type { Square } from '@purechess/shared';

export type AnnotationColor = 'green' | 'red' | 'blue' | 'yellow';

export interface ArrowShape {
  type: 'arrow';
  from: Square;
  to: Square;
  color: AnnotationColor;
}

export interface CircleShape {
  type: 'circle';
  square: Square;
  color: AnnotationColor;
}

export type BoardShape = ArrowShape | CircleShape;

export function sameShape(a: BoardShape, b: BoardShape): boolean {
  if (a.type === 'circle' && b.type === 'circle') {
    return a.color === b.color && a.square === b.square;
  }
  if (a.type === 'arrow' && b.type === 'arrow') {
    return a.color === b.color && a.from === b.from && a.to === b.to;
  }
  return false;
}

/** Drawing an identical shape removes it (toggle); anything else appends. */
export function toggleShape(shapes: readonly BoardShape[], next: BoardShape): BoardShape[] {
  return shapes.some((s) => sameShape(s, next))
    ? shapes.filter((s) => !sameShape(s, next))
    : [...shapes, next];
}

/** Modifier keys pick the brush: shift=red, alt/meta=blue, ctrl=yellow, none=green. */
export function colorFromModifiers(e: {
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): AnnotationColor {
  if (e.shiftKey) return 'red';
  if (e.altKey || e.metaKey) return 'blue';
  if (e.ctrlKey) return 'yellow';
  return 'green';
}

/**
 * UCI best move ("e2e4", "e7e8q") → engine arrow, or null for anything that
 * isn't a move (empty, "(none)" on terminal positions, garbage).
 */
export function bestMoveArrow(
  uci: string | null | undefined,
  color: AnnotationColor = 'green',
): ArrowShape | null {
  if (!uci) return null;
  const m = /^([a-h][1-8])([a-h][1-8])/.exec(uci);
  if (!m || m[1] === m[2]) return null;
  return { type: 'arrow', from: m[1] as Square, to: m[2] as Square, color };
}

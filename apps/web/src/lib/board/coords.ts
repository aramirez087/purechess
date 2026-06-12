import type { Square } from '@purechess/shared';
import type { Orientation } from './types';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

/** Drops up to this many square-widths outside the board clamp to the nearest
 *  edge square; beyond it the drop resolves to no square (drag cancels). */
export const DROP_MARGIN_SQUARES = 0.5;

/** Touch drops snap to the nearest legal destination only when its center is
 *  within this many square-widths of the pointer. */
export const TOUCH_SNAP_RADIUS_SQUARES = 2;

/** Minimal subset of DOMRect the coordinate math needs. */
export interface BoardRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getSquareAt(orientation: Orientation, fileIdx: number, rankIdx: number): Square {
  const file = orientation === 'white' ? FILES[fileIdx] : FILES[7 - fileIdx];
  const rank = orientation === 'white' ? RANKS[rankIdx] : RANKS[7 - rankIdx];
  return `${file}${rank}` as Square;
}

/** Inverse of getSquareAt: display-grid indices (0,0 = top-left on screen). */
export function squareToIndices(
  orientation: Orientation,
  square: Square,
): { fileIdx: number; rankIdx: number } {
  const fileIdx = square.charCodeAt(0) - 97;
  const rankIdx = 8 - Number(square[1]);
  return orientation === 'white'
    ? { fileIdx, rankIdx }
    : { fileIdx: 7 - fileIdx, rankIdx: 7 - rankIdx };
}

/**
 * Derives the square under a viewport point from the board's bounding rect —
 * pure math, no DOM hit-testing, so overlays (grain, animation layer, drag
 * ghost) can never swallow a drop. Points up to `marginSquares` outside the
 * rect clamp to the nearest edge square; farther points return null.
 */
export function pointToSquare(
  rect: BoardRect | null | undefined,
  orientation: Orientation,
  x: number,
  y: number,
  marginSquares: number = DROP_MARGIN_SQUARES,
): Square | null {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  const fx = (8 * (x - rect.left)) / rect.width;
  const fy = (8 * (y - rect.top)) / rect.height;
  if (fx < -marginSquares || fx >= 8 + marginSquares) return null;
  if (fy < -marginSquares || fy >= 8 + marginSquares) return null;
  const fileIdx = Math.max(0, Math.min(7, Math.floor(fx)));
  const rankIdx = Math.max(0, Math.min(7, Math.floor(fy)));
  return getSquareAt(orientation, fileIdx, rankIdx);
}

/**
 * Fat-finger snap (chessground's getSnappedKeyAtDomPos adapted to a
 * legal-dest pool): returns the legal destination whose pixel center is
 * nearest the pointer, if within `maxRadiusSquares` square-widths. The raw
 * square wins when it is already legal, when there are no destinations
 * (premove, readOnly), or when every destination is out of range — so a
 * far-away drop still cancels instead of teleporting into a distant move.
 */
export function snapToNearestDest(
  rect: BoardRect,
  orientation: Orientation,
  dests: readonly Square[],
  raw: Square,
  x: number,
  y: number,
  maxRadiusSquares: number = TOUCH_SNAP_RADIUS_SQUARES,
): Square {
  if (dests.length === 0 || dests.includes(raw)) return raw;
  if (rect.width <= 0 || rect.height <= 0) return raw;
  const squareW = rect.width / 8;
  const squareH = rect.height / 8;
  const maxDistSq = (maxRadiusSquares * squareW) ** 2;
  let best = raw;
  let bestDistSq = Infinity;
  for (const dest of dests) {
    const { fileIdx, rankIdx } = squareToIndices(orientation, dest);
    const cx = rect.left + (fileIdx + 0.5) * squareW;
    const cy = rect.top + (rankIdx + 0.5) * squareH;
    const distSq = (x - cx) ** 2 + (y - cy) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = dest;
    }
  }
  return bestDistSq <= maxDistSq ? best : raw;
}

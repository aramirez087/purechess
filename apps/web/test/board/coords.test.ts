import { describe, expect, it } from 'vitest';
import type { Square } from '@purechess/shared';
import {
  getSquareAt,
  pointToSquare,
  snapToNearestDest,
  squareToIndices,
  DROP_MARGIN_SQUARES,
  TOUCH_SNAP_RADIUS_SQUARES,
  type BoardRect,
} from '@/lib/board/coords';

// Non-zero origin so a missing rect.left/top subtraction fails the suite.
const RECT: BoardRect = { left: 100, top: 50, width: 800, height: 800 };
const SQ = RECT.width / 8; // 100

/** Pixel center of a square for the given orientation. */
function center(square: Square, orientation: 'white' | 'black' = 'white') {
  const { fileIdx, rankIdx } = squareToIndices(orientation, square);
  return { x: RECT.left + (fileIdx + 0.5) * SQ, y: RECT.top + (rankIdx + 0.5) * SQ };
}

describe('squareToIndices / getSquareAt round-trip', () => {
  it('inverts getSquareAt for every square in both orientations', () => {
    for (const orientation of ['white', 'black'] as const) {
      for (let f = 0; f < 8; f++) {
        for (let r = 0; r < 8; r++) {
          const sq = getSquareAt(orientation, f, r);
          expect(squareToIndices(orientation, sq)).toEqual({ fileIdx: f, rankIdx: r });
        }
      }
    }
  });
});

describe('pointToSquare', () => {
  it('maps corners and center for white orientation', () => {
    expect(pointToSquare(RECT, 'white', RECT.left + 1, RECT.top + 1)).toBe('a8');
    expect(pointToSquare(RECT, 'white', RECT.left + RECT.width - 1, RECT.top + 1)).toBe('h8');
    expect(pointToSquare(RECT, 'white', RECT.left + 1, RECT.top + RECT.height - 1)).toBe('a1');
    expect(
      pointToSquare(RECT, 'white', RECT.left + RECT.width - 1, RECT.top + RECT.height - 1),
    ).toBe('h1');
    const c = center('e4');
    expect(pointToSquare(RECT, 'white', c.x, c.y)).toBe('e4');
  });

  it('maps corners and center for black orientation', () => {
    expect(pointToSquare(RECT, 'black', RECT.left + 1, RECT.top + 1)).toBe('h1');
    expect(pointToSquare(RECT, 'black', RECT.left + RECT.width - 1, RECT.top + 1)).toBe('a1');
    expect(pointToSquare(RECT, 'black', RECT.left + 1, RECT.top + RECT.height - 1)).toBe('h8');
    const c = center('e4', 'black');
    expect(pointToSquare(RECT, 'black', c.x, c.y)).toBe('e4');
  });

  it('clamps the exact right/bottom edge to the edge square', () => {
    expect(
      pointToSquare(RECT, 'white', RECT.left + RECT.width, RECT.top + RECT.height),
    ).toBe('h1');
  });

  it('clamps drops just outside the board within the margin', () => {
    const margin = DROP_MARGIN_SQUARES * SQ;
    expect(pointToSquare(RECT, 'white', RECT.left - margin + 1, RECT.top + 4.5 * SQ)).toBe('a4');
    expect(
      pointToSquare(RECT, 'white', RECT.left + RECT.width + margin - 1, RECT.top + 0.5 * SQ),
    ).toBe('h8');
  });

  it('returns null beyond the margin (drag-off-board cancel)', () => {
    const margin = DROP_MARGIN_SQUARES * SQ;
    expect(pointToSquare(RECT, 'white', RECT.left - margin - 1, RECT.top + 4 * SQ)).toBeNull();
    expect(
      pointToSquare(RECT, 'white', RECT.left + 4 * SQ, RECT.top + RECT.height + margin + 1),
    ).toBeNull();
    expect(pointToSquare(RECT, 'white', RECT.left - 300, RECT.top - 300)).toBeNull();
  });

  it('returns null for a missing or zero-size rect (jsdom, unmounted)', () => {
    expect(pointToSquare(null, 'white', 10, 10)).toBeNull();
    expect(pointToSquare({ left: 0, top: 0, width: 0, height: 0 }, 'white', 0, 0)).toBeNull();
  });
});

describe('snapToNearestDest', () => {
  const dests: Square[] = ['e3', 'e4'];

  it('returns the raw square when it is already a legal dest', () => {
    const c = center('e4');
    expect(snapToNearestDest(RECT, 'white', dests, 'e4', c.x, c.y)).toBe('e4');
  });

  it('returns the raw square when there are no dests (premove/readOnly)', () => {
    const c = center('e5');
    expect(snapToNearestDest(RECT, 'white', [], 'e5', c.x, c.y)).toBe('e5');
  });

  it('snaps to the nearest dest center', () => {
    // Drop inside e5, near its bottom edge — e4's center is the closest dest.
    const e5 = center('e5');
    const x = e5.x;
    const y = e5.y + 0.4 * SQ;
    expect(snapToNearestDest(RECT, 'white', dests, 'e5', x, y)).toBe('e4');
  });

  it('prefers the closer of two dests', () => {
    const e3 = center('e3');
    expect(snapToNearestDest(RECT, 'white', ['e4', 'e3'], 'd3', e3.x - 0.6 * SQ, e3.y)).toBe('e3');
  });

  it('respects the snap radius cap', () => {
    const e4 = center('e4');
    const inRange = e4.y - (TOUCH_SNAP_RADIUS_SQUARES - 0.1) * SQ;
    const outOfRange = e4.y - (TOUCH_SNAP_RADIUS_SQUARES + 0.1) * SQ;
    expect(snapToNearestDest(RECT, 'white', ['e4'], 'e6', e4.x, inRange)).toBe('e4');
    expect(snapToNearestDest(RECT, 'white', ['e4'], 'e6', e4.x, outOfRange)).toBe('e6');
  });

  it('snaps correctly with black orientation (index inversion)', () => {
    // Black orientation: e4's screen position is mirrored; drop near its
    // mirrored center must still snap to e4.
    const c = center('e4', 'black');
    expect(
      snapToNearestDest(RECT, 'black', dests, 'd4', c.x + 0.45 * SQ, c.y),
    ).toBe('e4');
  });
});

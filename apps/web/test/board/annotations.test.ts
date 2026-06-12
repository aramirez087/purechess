import { describe, expect, it } from 'vitest';
import {
  bestMoveArrow,
  colorFromModifiers,
  sameShape,
  toggleShape,
  type ArrowShape,
  type BoardShape,
  type CircleShape,
} from '@/lib/board/annotations';

const arrow = (from: string, to: string, color = 'green'): ArrowShape =>
  ({ type: 'arrow', from, to, color }) as ArrowShape;
const circle = (square: string, color = 'green'): CircleShape =>
  ({ type: 'circle', square, color }) as CircleShape;

describe('toggleShape', () => {
  it('appends a new shape', () => {
    const next = toggleShape([], arrow('e2', 'e4'));
    expect(next).toEqual([arrow('e2', 'e4')]);
  });

  it('removes an identical shape (toggle off)', () => {
    const shapes: BoardShape[] = [arrow('e2', 'e4'), circle('d5')];
    expect(toggleShape(shapes, arrow('e2', 'e4'))).toEqual([circle('d5')]);
    expect(toggleShape(shapes, circle('d5'))).toEqual([arrow('e2', 'e4')]);
  });

  it('same coords with a different color appends instead of removing', () => {
    const shapes: BoardShape[] = [arrow('e2', 'e4', 'green')];
    const next = toggleShape(shapes, arrow('e2', 'e4', 'red'));
    expect(next).toHaveLength(2);
  });

  it('does not mutate the input array', () => {
    const shapes: BoardShape[] = [circle('a1')];
    toggleShape(shapes, circle('a1'));
    toggleShape(shapes, circle('h8'));
    expect(shapes).toEqual([circle('a1')]);
  });

  it('never matches an arrow against a circle', () => {
    expect(sameShape(arrow('e4', 'e4' as never), circle('e4'))).toBe(false);
    const next = toggleShape([circle('e4')], arrow('e2', 'e4'));
    expect(next).toHaveLength(2);
  });
});

describe('colorFromModifiers', () => {
  const mods = (over: Partial<Record<'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey', boolean>>) => ({
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...over,
  });

  it('defaults to green', () => {
    expect(colorFromModifiers(mods({}))).toBe('green');
  });

  it('shift → red', () => {
    expect(colorFromModifiers(mods({ shiftKey: true }))).toBe('red');
  });

  it('alt or meta → blue', () => {
    expect(colorFromModifiers(mods({ altKey: true }))).toBe('blue');
    expect(colorFromModifiers(mods({ metaKey: true }))).toBe('blue');
  });

  it('ctrl → yellow', () => {
    expect(colorFromModifiers(mods({ ctrlKey: true }))).toBe('yellow');
  });

  it('shift wins over other modifiers', () => {
    expect(colorFromModifiers(mods({ shiftKey: true, ctrlKey: true, altKey: true }))).toBe('red');
  });
});

describe('bestMoveArrow', () => {
  it('parses a plain UCI move', () => {
    expect(bestMoveArrow('e2e4')).toEqual(arrow('e2', 'e4'));
  });

  it('parses a promotion UCI move (drops the promo letter)', () => {
    expect(bestMoveArrow('e7e8q')).toEqual(arrow('e7', 'e8'));
  });

  it('accepts a brush color', () => {
    expect(bestMoveArrow('g1f3', 'blue')).toEqual(arrow('g1', 'f3', 'blue'));
  });

  it('rejects empty, "(none)", null-moves and garbage', () => {
    expect(bestMoveArrow(undefined)).toBeNull();
    expect(bestMoveArrow(null)).toBeNull();
    expect(bestMoveArrow('')).toBeNull();
    expect(bestMoveArrow('(none)')).toBeNull();
    expect(bestMoveArrow('0000')).toBeNull();
    expect(bestMoveArrow('e2e2')).toBeNull();
    expect(bestMoveArrow('z9k0')).toBeNull();
  });
});

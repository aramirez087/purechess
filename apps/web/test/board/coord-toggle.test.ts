import { describe, it, expect } from 'vitest';
import { fileLabel, rankLabel } from '@/lib/board/coord-toggle';

describe('fileLabel', () => {
  it('returns a for index 0 when white orientation', () => {
    expect(fileLabel(0, 'white')).toBe('a');
  });

  it('returns h for index 7 when white orientation', () => {
    expect(fileLabel(7, 'white')).toBe('h');
  });

  it('returns h for index 0 when black orientation', () => {
    expect(fileLabel(0, 'black')).toBe('h');
  });

  it('returns a for index 7 when black orientation', () => {
    expect(fileLabel(7, 'black')).toBe('a');
  });
});

describe('rankLabel', () => {
  it('returns 8 for index 0 when white orientation (top row)', () => {
    expect(rankLabel(0, 'white')).toBe('8');
  });

  it('returns 1 for index 7 when white orientation (bottom row)', () => {
    expect(rankLabel(7, 'white')).toBe('1');
  });

  it('returns 1 for index 0 when black orientation (top row)', () => {
    expect(rankLabel(0, 'black')).toBe('1');
  });

  it('returns 8 for index 7 when black orientation (bottom row)', () => {
    expect(rankLabel(7, 'black')).toBe('8');
  });
});

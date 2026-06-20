import { describe, expect, it } from 'vitest';
import {
  clampTimeControlIndex,
  DEFAULT_PLAY_PREFERENCES,
  formatPlayPrefsLabel,
  resolveTimeControl,
} from '@/lib/play-preferences';

describe('play-preferences', () => {
  it('clamps out-of-range indices to valid presets', () => {
    expect(clampTimeControlIndex(-1)).toBe(0);
    expect(clampTimeControlIndex(99)).toBe(6);
    expect(clampTimeControlIndex(Number.NaN)).toBe(2);
  });

  it('resolves the default 3+0 blitz preset', () => {
    const tc = resolveTimeControl(DEFAULT_PLAY_PREFERENCES.timeControlIndex);
    expect(tc.label).toBe('3+0');
    expect(tc.category).toBe('blitz');
  });

  it('formats a human-readable quick-match label', () => {
    expect(formatPlayPrefsLabel(DEFAULT_PLAY_PREFERENCES)).toBe('Blitz 3+0 · Rated');
    expect(
      formatPlayPrefsLabel({ timeControlIndex: 5, rated: false }),
    ).toBe('Rapid 10+0 · Casual');
  });
});
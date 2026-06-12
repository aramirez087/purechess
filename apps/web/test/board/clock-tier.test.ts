import { describe, it, expect } from 'vitest';
import { clockTier } from '@/lib/board/clock-tier';

describe('clockTier', () => {
  it('is normal when no live ms is known', () => {
    expect(clockTier(undefined)).toBe('normal');
  });

  it('is normal at and above 30s', () => {
    expect(clockTier(30_000)).toBe('normal');
    expect(clockTier(600_000)).toBe('normal');
  });

  it('is caution from 10s up to 30s', () => {
    expect(clockTier(29_999)).toBe('caution');
    expect(clockTier(10_000)).toBe('caution');
  });

  it('is critical from 3s up to 10s', () => {
    expect(clockTier(9_999)).toBe('critical');
    expect(clockTier(3_000)).toBe('critical');
  });

  it('is dying under 3s while time remains', () => {
    expect(clockTier(2_999)).toBe('dying');
    expect(clockTier(1)).toBe('dying');
  });

  it('is out at zero and below', () => {
    expect(clockTier(0)).toBe('out');
    expect(clockTier(-50)).toBe('out');
  });
});

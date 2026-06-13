import { describe, it, expect } from 'vitest';
import { cpToWinPercent, winLossToAccuracy, accuracyBarColor } from '@/lib/board/accuracy';

describe('cpToWinPercent', () => {
  it('maps an equal position to 50%', () => {
    expect(cpToWinPercent(0)).toBeCloseTo(50, 5);
  });

  it('is symmetric about 0', () => {
    expect(cpToWinPercent(300) + cpToWinPercent(-300)).toBeCloseTo(100, 5);
  });

  it('saturates near 0/100 for mate-magnitude scores', () => {
    expect(cpToWinPercent(10000)).toBeGreaterThan(99.9);
    expect(cpToWinPercent(-10000)).toBeLessThan(0.1);
  });

  it('is monotonically increasing in cp', () => {
    const samples = [-1000, -300, -50, 0, 50, 300, 1000];
    for (let i = 1; i < samples.length; i++) {
      expect(cpToWinPercent(samples[i])).toBeGreaterThan(cpToWinPercent(samples[i - 1]));
    }
  });
});

describe('winLossToAccuracy', () => {
  it('scores a move with no win-chance loss at 100', () => {
    expect(winLossToAccuracy(0)).toBeCloseTo(100, 5);
  });

  it('decays toward 0 as win-chance loss grows', () => {
    expect(winLossToAccuracy(100)).toBeCloseTo(0, 1);
  });

  it('is monotonically non-increasing in win-chance loss', () => {
    const samples = [0, 2, 5, 10, 20, 40, 80];
    for (let i = 1; i < samples.length; i++) {
      expect(winLossToAccuracy(samples[i])).toBeLessThanOrEqual(
        winLossToAccuracy(samples[i - 1]),
      );
    }
  });

  it('clamps to the 0–100 range', () => {
    expect(winLossToAccuracy(-50)).toBeLessThanOrEqual(100);
    expect(winLossToAccuracy(-50)).toBeGreaterThanOrEqual(0);
    expect(winLossToAccuracy(1e6)).toBe(0);
  });
});

describe('accuracyBarColor', () => {
  it('bands accuracy best→worst at the documented boundaries', () => {
    expect(accuracyBarColor(95)).toBe('text-emerald-400');
    expect(accuracyBarColor(90)).toBe('text-emerald-400');
    expect(accuracyBarColor(89)).toBe('text-green-400');
    expect(accuracyBarColor(75)).toBe('text-green-400');
    expect(accuracyBarColor(74)).toBe('text-yellow-400');
    expect(accuracyBarColor(60)).toBe('text-yellow-400');
    expect(accuracyBarColor(59)).toBe('text-orange-400');
    expect(accuracyBarColor(45)).toBe('text-orange-400');
    expect(accuracyBarColor(44)).toBe('text-red-500');
    expect(accuracyBarColor(0)).toBe('text-red-500');
  });
});

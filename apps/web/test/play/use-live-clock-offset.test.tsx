import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLiveClock } from '@/hooks/use-live-clock';

describe('useLiveClock server offset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const clock = { whiteMs: 60_000, blackMs: 60_000, lastTickAt: 8_000, incrementMs: 0 };

  it('drains the side to move from lastTickAt with no offset', () => {
    const { result } = renderHook(() => useLiveClock(clock, 'white', true));
    // elapsed = 10000 - 8000
    expect(result.current).toEqual({ whiteMs: 58_000, blackMs: 60_000 });
  });

  it('corrects elapsed time by the server offset', () => {
    // Server clock runs 1.5s ahead of this client: real elapsed is 3.5s.
    const { result } = renderHook(() => useLiveClock(clock, 'white', true, 1_500));
    expect(result.current).toEqual({ whiteMs: 56_500, blackMs: 60_000 });
  });

  it('a behind-server offset shortens elapsed and never goes negative', () => {
    const { result } = renderHook(() => useLiveClock(clock, 'black', true, -5_000));
    // 10000 - 5000 - 8000 = -3000 → clamped to 0 elapsed
    expect(result.current).toEqual({ whiteMs: 60_000, blackMs: 60_000 });
  });
});

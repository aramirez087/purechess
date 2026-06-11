import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLiveClock } from '@/hooks/use-live-clock';

/**
 * A backgrounded tab throttles/suspends the 200ms interval, so the clock
 * stops re-rendering and shows a frozen, stale value. On wake it must snap to
 * true elapsed time, not "drift in" as the interval catches up. The hook
 * forces a re-render on visibilitychange->visible (and online) so the next
 * render recomputes against real Date.now().
 */
describe('useLiveClock visibility snap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const clock = { whiteMs: 60_000, blackMs: 60_000, lastTickAt: 8_000, incrementMs: 0 };

  it('snaps to true elapsed on visibilitychange->visible without an interval tick', () => {
    const { result } = renderHook(() => useLiveClock(clock, 'white', true));
    // Initial render: elapsed = 10000 - 8000 = 2000.
    expect(result.current).toEqual({ whiteMs: 58_000, blackMs: 60_000 });

    // Tab backgrounded: advance wall-clock 30s WITHOUT letting the interval
    // run (simulate a throttled/suspended timer by not flushing it). Jump the
    // system clock forward; the frozen render still shows 58_000.
    vi.setSystemTime(40_000);
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    // One forced tick → recompute: elapsed = 40000 - 8000 = 32000.
    expect(result.current).toEqual({ whiteMs: 28_000, blackMs: 60_000 });
  });

  it('snaps on the online event too', () => {
    const { result } = renderHook(() => useLiveClock(clock, 'black', true));
    expect(result.current).toEqual({ whiteMs: 60_000, blackMs: 58_000 });

    vi.setSystemTime(25_000);
    act(() => window.dispatchEvent(new Event('online')));

    // elapsed = 25000 - 8000 = 17000, draining black (side to move).
    expect(result.current).toEqual({ whiteMs: 60_000, blackMs: 43_000 });
  });

  it('does not force a tick while the tab stays hidden', () => {
    const { result } = renderHook(() => useLiveClock(clock, 'white', true));
    expect(result.current).toEqual({ whiteMs: 58_000, blackMs: 60_000 });

    vi.setSystemTime(40_000);
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    // Hidden → no forced re-render; the stale frozen value persists.
    expect(result.current).toEqual({ whiteMs: 58_000, blackMs: 60_000 });
  });

  it('registers no wake listener for an untimed game (no clock)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    renderHook(() => useLiveClock(null, 'white', true));
    expect(
      addSpy.mock.calls.some(([type]) => type === 'visibilitychange'),
    ).toBe(false);
    addSpy.mockRestore();
  });
});

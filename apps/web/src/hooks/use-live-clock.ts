'use client';

import { useEffect, useState } from 'react';
import type { ComputerClockDto } from '@purechess/shared';

/** mm:ss (h:mm:ss above an hour, s.t tenths under 10s). */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 10_000) {
    return `${Math.floor(clamped / 1000)}.${Math.floor((clamped % 1000) / 100)}`;
  }
  const totalSeconds = Math.ceil(clamped / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface LiveClock {
  whiteMs: number;
  blackMs: number;
}

/**
 * Live per-side remaining time derived from a serialized server clock: the
 * side to move drains in real time from `lastTickAt`, the other side is
 * frozen at its stored value. Re-renders 5×/s while `running`.
 *
 * Returns null for untimed games (no clock in the DTO).
 */
export function useLiveClock(
  clock: ComputerClockDto | null | undefined,
  sideToMove: 'white' | 'black',
  running: boolean,
  /**
   * Estimated server-minus-client clock skew (ms). `lastTickAt` is a server
   * timestamp; draining it against a skewed local clock drifts by exactly
   * the skew. Callers with a server time signal (WS pushes) pass it here.
   */
  serverOffsetMs = 0,
): LiveClock | null {
  const [, setTick] = useState(0);

  const hasClock = clock != null;
  useEffect(() => {
    if (!hasClock || !running) return;
    const id = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [hasClock, running]);

  // A backgrounded/throttled tab freezes the interval above, so on wake the
  // clock shows a stale value and visibly "drifts in" as the interval catches
  // up. Forcing one tick on wake makes the next render recompute against real
  // `Date.now()` + offset, snapping straight to true time. The drain formula
  // is unchanged — this only re-renders.
  useEffect(() => {
    if (!hasClock) return;
    const wake = () => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1);
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [hasClock]);

  if (!clock) return null;

  const elapsed = running
    ? Math.max(0, Date.now() + serverOffsetMs - clock.lastTickAt)
    : 0;
  return {
    whiteMs: Math.max(0, clock.whiteMs - (sideToMove === 'white' ? elapsed : 0)),
    blackMs: Math.max(0, clock.blackMs - (sideToMove === 'black' ? elapsed : 0)),
  };
}

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
): LiveClock | null {
  const [, setTick] = useState(0);

  const hasClock = clock != null;
  useEffect(() => {
    if (!hasClock || !running) return;
    const id = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [hasClock, running]);

  if (!clock) return null;

  const elapsed = running ? Math.max(0, Date.now() - clock.lastTickAt) : 0;
  return {
    whiteMs: Math.max(0, clock.whiteMs - (sideToMove === 'white' ? elapsed : 0)),
    blackMs: Math.max(0, clock.blackMs - (sideToMove === 'black' ? elapsed : 0)),
  };
}

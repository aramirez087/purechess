import { Color } from '@purchess/shared';

export type ClockSnapshot = {
  whiteMs: bigint;
  blackMs: bigint;
  lastTickAt: bigint;
  incrementMs: bigint;
};

export function makeClock(
  whiteMs: number,
  blackMs: number,
  incrementMs: number,
  nowMs: number,
): ClockSnapshot {
  return {
    whiteMs: BigInt(whiteMs),
    blackMs: BigInt(blackMs),
    lastTickAt: BigInt(nowMs),
    incrementMs: BigInt(incrementMs),
  };
}

export function tickClock(clock: ClockSnapshot, nowMs: number, sideToMove: Color): ClockSnapshot {
  const elapsed = BigInt(nowMs) - clock.lastTickAt;
  if (sideToMove === 'w') {
    const remaining = clock.whiteMs - elapsed;
    return { ...clock, whiteMs: remaining < 0n ? 0n : remaining, lastTickAt: BigInt(nowMs) };
  }
  const remaining = clock.blackMs - elapsed;
  return { ...clock, blackMs: remaining < 0n ? 0n : remaining, lastTickAt: BigInt(nowMs) };
}

export function applyIncrement(clock: ClockSnapshot, side: Color): ClockSnapshot {
  if (side === 'w') {
    return { ...clock, whiteMs: clock.whiteMs + clock.incrementMs };
  }
  return { ...clock, blackMs: clock.blackMs + clock.incrementMs };
}

export function isTimeout(clock: ClockSnapshot, nowMs: number, sideToMove: Color): boolean {
  const elapsed = BigInt(nowMs) - clock.lastTickAt;
  if (sideToMove === 'w') {
    return clock.whiteMs <= elapsed;
  }
  return clock.blackMs <= elapsed;
}

export function serializeClock(clock: ClockSnapshot): {
  whiteMs: number;
  blackMs: number;
  lastTickAt: number;
  incrementMs: number;
} {
  return {
    whiteMs: Number(clock.whiteMs),
    blackMs: Number(clock.blackMs),
    lastTickAt: Number(clock.lastTickAt),
    incrementMs: Number(clock.incrementMs),
  };
}

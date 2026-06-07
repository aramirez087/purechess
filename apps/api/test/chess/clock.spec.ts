import { applyIncrement, isTimeout, makeClock, serializeClock, tickClock } from '../../src/chess/engine/clock';

describe('clock', () => {
  const initial = makeClock(300000, 300000, 2000, 1000000);

  it('tickClock decrements white time by elapsed ms', () => {
    const ticked = tickClock(initial, 1001000, 'w');
    expect(ticked.whiteMs).toBe(299000n);
    expect(ticked.blackMs).toBe(300000n);
    expect(ticked.lastTickAt).toBe(1001000n);
  });

  it('tickClock decrements black time by elapsed ms', () => {
    const ticked = tickClock(initial, 1005000, 'b');
    expect(ticked.blackMs).toBe(295000n);
    expect(ticked.whiteMs).toBe(300000n);
  });

  it('tickClock clamps to 0 on timeout', () => {
    const ticked = tickClock(initial, 1400000, 'w');
    expect(ticked.whiteMs).toBe(0n);
  });

  it('tickClock updates lastTickAt', () => {
    const ticked = tickClock(initial, 1005000, 'w');
    expect(ticked.lastTickAt).toBe(1005000n);
  });

  it('applyIncrement adds increment to white', () => {
    const result = applyIncrement(initial, 'w');
    expect(result.whiteMs).toBe(302000n);
    expect(result.blackMs).toBe(300000n);
  });

  it('applyIncrement adds increment to black', () => {
    const result = applyIncrement(initial, 'b');
    expect(result.blackMs).toBe(302000n);
    expect(result.whiteMs).toBe(300000n);
  });

  it('isTimeout returns true when elapsed >= remaining', () => {
    const clock = makeClock(1000, 300000, 0, 1000000);
    expect(isTimeout(clock, 1001000, 'w')).toBe(true);
  });

  it('isTimeout returns true at exact depletion', () => {
    const clock = makeClock(1000, 300000, 0, 1000000);
    expect(isTimeout(clock, 1001000, 'w')).toBe(true);
  });

  it('isTimeout returns false when time > elapsed', () => {
    expect(isTimeout(initial, 1001000, 'w')).toBe(false);
  });

  it('isTimeout checks correct side', () => {
    const clock = makeClock(300000, 0, 0, 1000000);
    expect(isTimeout(clock, 1000001, 'b')).toBe(true);
    expect(isTimeout(clock, 1000001, 'w')).toBe(false);
  });

  it('serializeClock converts bigints to numbers', () => {
    const serialized = serializeClock(initial);
    expect(serialized.whiteMs).toBe(300000);
    expect(serialized.blackMs).toBe(300000);
    expect(serialized.incrementMs).toBe(2000);
    expect(serialized.lastTickAt).toBe(1000000);
    expect(typeof serialized.whiteMs).toBe('number');
    expect(typeof serialized.blackMs).toBe('number');
  });
});

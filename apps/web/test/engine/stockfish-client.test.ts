import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EngineCancelledError,
  EngineTimeoutError,
  __resetForTests,
  analyze,
  cancel,
  getBestMove,
  getHint,
  getHumanMove,
  parseInfoLine,
  warmUp,
} from '../../src/lib/engine/stockfish-client';

/**
 * Mock Worker that records postMessage calls and lets a test drive the
 * onmessage stream. Auto-answers the `uci` handshake with `uciok`. When
 * `MockWorker.goScript` is set, each scripted line is emitted after a `go`.
 */
class MockWorker {
  static instances: MockWorker[] = [];
  static goScript: string[] | null = null;

  static get last(): MockWorker {
    const w = MockWorker.instances[MockWorker.instances.length - 1];
    if (!w) throw new Error('no MockWorker created');
    return w;
  }

  messages: string[] = [];
  private listeners: Record<string, ((e: unknown) => void)[]> = {
    message: [],
    error: [],
  };

  constructor(public src: string) {
    MockWorker.instances.push(this);
  }

  addEventListener(type: string, cb: (e: unknown) => void) {
    (this.listeners[type] ??= []).push(cb);
  }

  removeEventListener(type: string, cb: (e: unknown) => void) {
    const l = this.listeners[type];
    if (l) this.listeners[type] = l.filter((x) => x !== cb);
  }

  postMessage(msg: string) {
    this.messages.push(msg);
    if (msg === 'uci') {
      queueMicrotask(() => this.emit('uciok'));
    } else if (msg.startsWith('go') && MockWorker.goScript) {
      const script = MockWorker.goScript;
      queueMicrotask(() => {
        for (const line of script) this.emit(line);
      });
    }
  }

  emit(data: string) {
    for (const cb of [...(this.listeners.message ?? [])]) cb({ data });
  }
}

/** Let queued microtasks (uciok → setoptions → go → scripted lines) settle. */
async function flush(times = 5) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

beforeEach(() => {
  (globalThis as unknown as { Worker: unknown }).Worker = MockWorker;
  MockWorker.instances = [];
  MockWorker.goScript = null;
  __resetForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('parseInfoLine', () => {
  it('parses a centipawn line', () => {
    const r = parseInfoLine('info depth 12 score cp 34 multipv 1 pv e2e4 e7e5');
    expect(r).toEqual({
      depth: 12,
      cp: 34,
      multipv: 1,
      bestmove: 'e2e4',
      pv: ['e2e4', 'e7e5'],
    });
  });

  it('parses a mate line without cp', () => {
    const r = parseInfoLine('info depth 20 score mate 3 multipv 1 pv h5f7 e8f7');
    expect(r?.mate).toBe(3);
    expect(r?.cp).toBeUndefined();
    expect(r?.bestmove).toBe('h5f7');
  });

  it('ignores non-info and pv-less lines', () => {
    expect(parseInfoLine('bestmove e2e4')).toBeNull();
    expect(parseInfoLine('info depth 1 seldepth 1 score cp 0')).toBeNull();
    expect(parseInfoLine('info string NNUE evaluation using ...')).toBeNull();
  });
});

describe('warmUp', () => {
  it('posts uci and resolves on uciok', async () => {
    await warmUp();
    expect(MockWorker.last.messages).toContain('uci');
  });
});

describe('analyze', () => {
  it('resolves a centipawn eval', async () => {
    MockWorker.goScript = [
      'info depth 12 score cp 34 multipv 1 pv e2e4 e7e5',
      'bestmove e2e4',
    ];
    const ev = await analyze('startfen', {});
    expect(ev).toMatchObject({
      cp: 34,
      depth: 12,
      bestmove: 'e2e4',
      pv: ['e2e4', 'e7e5'],
    });
    expect(MockWorker.last.messages).toContain('go movetime 1000');
  });

  it('resolves a mate eval with no cp', async () => {
    MockWorker.goScript = [
      'info depth 18 score mate 2 multipv 1 pv d1h5 g7g6',
      'bestmove d1h5',
    ];
    const ev = await analyze('fen', {});
    expect(ev.mate).toBe(2);
    expect(ev.cp).toBeUndefined();
  });

  it('returns the multipv=1 line when multiple are reported', async () => {
    MockWorker.goScript = [
      'info depth 12 score cp 80 multipv 1 pv e2e4 e7e5',
      'info depth 12 score cp 40 multipv 2 pv d2d4 d7d5',
      'bestmove e2e4',
    ];
    const ev = await analyze('fen', { multiPv: 2 });
    expect(ev.bestmove).toBe('e2e4');
    expect(MockWorker.last.messages).toContain('setoption name MultiPV value 2');
  });

  it('honours a custom movetime', async () => {
    MockWorker.goScript = [
      'info depth 8 score cp 10 multipv 1 pv g1f3 d7d5',
      'bestmove g1f3',
    ];
    await analyze('fen', { movetimeMs: 2500 });
    expect(MockWorker.last.messages).toContain('go movetime 2500');
  });

  it('emits ELO options when eloTarget is set', async () => {
    MockWorker.goScript = [
      'info depth 6 score cp 5 multipv 1 pv e2e4 c7c5',
      'bestmove e2e4',
    ];
    await analyze('fen', { eloTarget: 1500 });
    expect(MockWorker.last.messages).toContain(
      'setoption name UCI_LimitStrength value true',
    );
    expect(MockWorker.last.messages).toContain(
      'setoption name UCI_Elo value 1500',
    );
  });

  it('clamps an out-of-range ELO target', async () => {
    MockWorker.goScript = [
      'info depth 6 score cp 5 multipv 1 pv e2e4 c7c5',
      'bestmove e2e4',
    ];
    await analyze('fen', { eloTarget: 50 });
    expect(MockWorker.last.messages).toContain(
      'setoption name UCI_Elo value 1320',
    );
  });

  it('emits Skill option (LimitStrength off) in skill mode', async () => {
    MockWorker.goScript = [
      'info depth 6 score cp 5 multipv 1 pv e2e4 c7c5',
      'bestmove e2e4',
    ];
    await analyze('fen', { skill: 7 });
    expect(MockWorker.last.messages).toContain(
      'setoption name UCI_LimitStrength value false',
    );
    expect(MockWorker.last.messages).toContain(
      'setoption name Skill Level value 7',
    );
  });
});

describe('getHint', () => {
  it('returns the best UCI move for the side to move', async () => {
    MockWorker.goScript = [
      'info depth 10 score cp 25 multipv 1 pv g1f3 g8f6',
      'bestmove g1f3',
    ];
    const move = await getHint('fen', 4);
    expect(move).toBe('g1f3');
  });
});

describe('getHumanMove (blunder knob)', () => {
  const script = [
    'info depth 12 score cp 80 multipv 1 pv e2e4 e7e5',
    'info depth 12 score cp 60 multipv 2 pv d2d4 d7d5',
    'info depth 12 score cp 10 multipv 3 pv b1c3 b8c6',
    'bestmove e2e4',
  ];

  it('is deterministic for a given seed', async () => {
    MockWorker.goScript = script;
    const a = await getHumanMove('fen', {
      blunderCp: 40,
      multiPv: 3,
      deterministicSeed: 7,
    });
    MockWorker.goScript = script;
    const b = await getHumanMove('fen', {
      blunderCp: 40,
      multiPv: 3,
      deterministicSeed: 7,
    });
    expect(a).toBe(b);
    // cp 10 line is outside the ±40 window of the cp 80 best, so it's excluded.
    expect(['e2e4', 'd2d4']).toContain(a);
  });

  it('returns the best move when no blunder window is set', async () => {
    MockWorker.goScript = script;
    const move = await getHumanMove('fen', { multiPv: 3 });
    expect(move).toBe('e2e4');
  });
});

describe('getBestMove (backward compatible)', () => {
  it('returns a UCI move from the bestmove line', async () => {
    MockWorker.goScript = [
      'info depth 12 score cp 20 multipv 1 pv d2d4 d7d5',
      'bestmove d2d4',
    ];
    const move = await getBestMove('fen', 4);
    expect(move).toBe('d2d4');
    expect(MockWorker.last.messages).toContain('go movetime 1000');
  });
});

describe('cancel', () => {
  it('stops the in-flight search and rejects with EngineCancelledError', async () => {
    MockWorker.goScript = null; // never emit bestmove → search hangs
    const p = analyze('fen', {});
    await flush();
    expect(MockWorker.last.messages).toContain('go movetime 1000');
    cancel();
    await expect(p).rejects.toBeInstanceOf(EngineCancelledError);
    expect(MockWorker.last.messages).toContain('stop');
  });
});

describe('timeout', () => {
  it('rejects with EngineTimeoutError when no bestmove arrives', async () => {
    vi.useFakeTimers();
    MockWorker.goScript = null;
    const p = analyze('fen', {});
    // resolve the worker handshake + go dispatch under fake timers
    await vi.advanceTimersByTimeAsync(0);
    const assertion = expect(p).rejects.toBeInstanceOf(EngineTimeoutError);
    await vi.advanceTimersByTimeAsync(11_000);
    await assertion;
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useMoveClassifier,
  classify,
  normalizeEval,
} from '@/hooks/use-move-classifier';
import { analyze } from '@/lib/engine/stockfish-client';
import type { WireMove } from '@purechess/shared';

vi.mock('@/lib/engine/stockfish-client', () => ({
  analyze: vi.fn(),
}));

function wireMove(ply: number, san: string, uci: string): WireMove {
  return {
    ply,
    san,
    uci,
    fenAfter: '',
    clockAfterMs: 0,
    moveTimeMs: 0,
    by: ply % 2 === 1 ? 'w' : 'b',
  } as WireMove;
}

const E4_E5: WireMove[] = [wireMove(1, 'e4', 'e2e4'), wireMove(2, 'e5', 'e7e5')];

describe('classify', () => {
  it('maps CPL thresholds to classes', () => {
    expect(classify(-15, 20)).toBe('brilliant');
    expect(classify(0, 20)).toBe('brilliant');
    expect(classify(5, 20)).toBe('best');
    expect(classify(20, 20)).toBe('good');
    expect(classify(50, 20)).toBe('inaccuracy');
    expect(classify(100, 20)).toBe('mistake');
    expect(classify(101, 20)).toBe('blunder');
  });

  it('returns forced when there is exactly one legal move, regardless of CPL', () => {
    expect(classify(500, 1)).toBe('forced');
  });
});

describe('normalizeEval', () => {
  it('passes centipawns through and defaults to 0', () => {
    expect(normalizeEval(42, undefined)).toBe(42);
    expect(normalizeEval(undefined, undefined)).toBe(0);
  });

  it('normalizes mate scores near ±10000', () => {
    expect(normalizeEval(undefined, 3)).toBe(9970);
    expect(normalizeEval(undefined, -3)).toBe(-10030);
  });
});

describe('useMoveClassifier', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('computes White-POV evals, per-move CPL, and ACPL', async () => {
    // Engine reports side-to-move POV: pos1 is black to move, so raw -10 = +10 White-POV.
    vi.mocked(analyze)
      .mockResolvedValueOnce({ depth: 12, bestmove: 'e2e4', pv: ['e2e4'], cp: 30 })
      .mockResolvedValueOnce({ depth: 12, bestmove: 'e7e5', pv: ['e7e5'], cp: -10 })
      .mockResolvedValueOnce({ depth: 12, bestmove: 'g1f3', pv: ['g1f3'], cp: 80 });

    const { result } = renderHook(() => useMoveClassifier(E4_E5));
    act(() => {
      result.current.run();
    });
    expect(result.current.running).toBe(true);
    await waitFor(() => expect(result.current.result).not.toBeNull());

    const r = result.current.result!;
    expect(r.evals).toEqual([30, 10, 80]);
    // White move: 30 - 10 = 20 cpl → good.
    expect(r.moves[0]).toMatchObject({
      ply: 1,
      san: 'e4',
      uci: 'e2e4',
      evalBefore: 30,
      evalAfter: 10,
      cpl: 20,
      class: 'good',
    });
    // Black move (wants lower eval): 80 - 10 = 70 cpl → mistake.
    expect(r.moves[1]).toMatchObject({ ply: 2, cpl: 70, class: 'mistake' });
    expect(r.whiteAcpl).toBe(20);
    expect(r.blackAcpl).toBe(70);
    expect(result.current.running).toBe(false);
    expect(result.current.progress).toBe(1);
  });

  it('clamps negative CPL to 0 and classifies the move brilliant', async () => {
    vi.mocked(analyze)
      .mockResolvedValueOnce({ depth: 12, bestmove: 'e2e4', pv: ['e2e4'], cp: 10 })
      // Black to move, raw -40 = +40 White-POV: White gained 30cp over the engine line.
      .mockResolvedValueOnce({ depth: 12, bestmove: 'e7e5', pv: ['e7e5'], cp: -40 });

    const { result } = renderHook(() => useMoveClassifier(E4_E5.slice(0, 1)));
    act(() => {
      result.current.run();
    });
    await waitFor(() => expect(result.current.result).not.toBeNull());

    expect(result.current.result!.moves[0]).toMatchObject({ cpl: 0, class: 'brilliant' });
    expect(result.current.result!.whiteAcpl).toBe(0);
  });

  it('normalizes mate scores to centipawns in the eval series', async () => {
    vi.mocked(analyze)
      .mockResolvedValueOnce({ depth: 12, bestmove: 'e2e4', pv: ['e2e4'], cp: 0 })
      // Black to move and mates in 3: 10000 - 30 = 9970, sign-flipped to White POV.
      .mockResolvedValueOnce({ depth: 12, bestmove: 'd8h4', pv: ['d8h4'], mate: 3 });

    const { result } = renderHook(() => useMoveClassifier(E4_E5.slice(0, 1)));
    act(() => {
      result.current.run();
    });
    await waitFor(() => expect(result.current.result).not.toBeNull());

    expect(result.current.result!.evals).toEqual([0, -9970]);
    expect(result.current.result!.moves[0].class).toBe('blunder');
  });

  it('marks a single-legal-move position forced and excludes it from ACPL', async () => {
    // White Kh1 in check from Qg2; Kxg2 is the only legal move. The position
    // after is K vs K — terminal, so the engine is consulted exactly once.
    const startFen = 'k7/8/8/8/8/8/6q1/7K w - - 0 1';
    const moves = [wireMove(1, 'Kxg2', 'h1g2')];
    vi.mocked(analyze).mockResolvedValueOnce({
      depth: 12,
      bestmove: 'h1g2',
      pv: ['h1g2'],
      cp: -900,
    });

    const { result } = renderHook(() => useMoveClassifier(moves, startFen));
    act(() => {
      result.current.run();
    });
    await waitFor(() => expect(result.current.result).not.toBeNull());

    expect(analyze).toHaveBeenCalledTimes(1);
    const r = result.current.result!;
    expect(r.evals).toEqual([-900, 0]);
    expect(r.moves[0].class).toBe('forced');
    expect(r.whiteAcpl).toBe(0);
    expect(r.blackAcpl).toBe(0);
  });

  it('reset() cancels an in-flight run', async () => {
    let resolveAnalyze!: (v: { depth: number; bestmove: string; pv: string[]; cp: number }) => void;
    vi.mocked(analyze).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAnalyze = resolve;
        }),
    );

    const { result } = renderHook(() => useMoveClassifier(E4_E5));
    act(() => {
      result.current.run();
    });
    expect(result.current.running).toBe(true);

    act(() => {
      result.current.reset();
    });
    expect(result.current.running).toBe(false);

    // Let the abandoned generation settle — it must not publish a result.
    await act(async () => {
      resolveAnalyze({ depth: 12, bestmove: 'e2e4', pv: ['e2e4'], cp: 30 });
      await Promise.resolve();
    });
    expect(result.current.result).toBeNull();
    expect(result.current.progress).toBe(0);
    expect(result.current.running).toBe(false);
  });

  it('does nothing when there are no moves', () => {
    const { result } = renderHook(() => useMoveClassifier([]));
    act(() => {
      result.current.run();
    });
    expect(result.current.running).toBe(false);
    expect(analyze).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useMoveClassifier,
  classify,
  normalizeEval,
} from '@/hooks/use-move-classifier';
import { cpToWinPercent, winLossToAccuracy } from '@/lib/board/accuracy';
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
  it('maps win-percentage-loss thresholds to classes', () => {
    expect(classify(0, 20)).toBe('best');
    expect(classify(1.9, 20)).toBe('best');
    expect(classify(2, 20)).toBe('good');
    expect(classify(4.9, 20)).toBe('good');
    expect(classify(5, 20)).toBe('inaccuracy');
    expect(classify(9.9, 20)).toBe('inaccuracy');
    expect(classify(10, 20)).toBe('mistake');
    expect(classify(19.9, 20)).toBe('mistake');
    expect(classify(20, 20)).toBe('blunder');
    expect(classify(60, 20)).toBe('blunder');
  });

  it('only marks brilliant when a sub-zero win-loss is also a sacrifice', () => {
    // Matching/beating the top line alone is just a best move, not a !!.
    expect(classify(-15, 20)).toBe('best');
    expect(classify(0, 20)).toBe('best');
    // A genuine sacrifice that keeps the win chance earns the !!.
    expect(classify(-15, 20, true)).toBe('brilliant');
    expect(classify(0, 20, true)).toBe('brilliant');
  });

  it('returns forced when there is exactly one legal move, regardless of loss', () => {
    expect(classify(60, 1)).toBe('forced');
    expect(classify(-50, 1, true)).toBe('forced');
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
    // White move: capped cpl 30 - 10 = 20.
    expect(r.moves[0]).toMatchObject({
      ply: 1,
      san: 'e4',
      uci: 'e2e4',
      evalBefore: 30,
      evalAfter: 10,
      cpl: 20,
    });
    // Black move (wants lower White-POV eval): capped cpl 80 - 10 = 70.
    expect(r.moves[1]).toMatchObject({ ply: 2, cpl: 70 });
    expect(r.whiteAcpl).toBe(20);
    expect(r.blackAcpl).toBe(70);
    expect(result.current.running).toBe(false);
    expect(result.current.progress).toBe(1);
  });

  it('derives per-move win-loss and accuracy from win probability', async () => {
    vi.mocked(analyze)
      .mockResolvedValueOnce({ depth: 12, bestmove: 'e2e4', pv: ['e2e4'], cp: 30 })
      .mockResolvedValueOnce({ depth: 12, bestmove: 'e7e5', pv: ['e7e5'], cp: -10 })
      .mockResolvedValueOnce({ depth: 12, bestmove: 'g1f3', pv: ['g1f3'], cp: 80 });

    const { result } = renderHook(() => useMoveClassifier(E4_E5));
    act(() => {
      result.current.run();
    });
    await waitFor(() => expect(result.current.result).not.toBeNull());

    const r = result.current.result!;
    // White loses 20cp — under the 25cp noise floor, so zero win-loss / 100 acc.
    expect(r.moves[0].cpl).toBe(20);
    expect(r.moves[0].winLoss).toBe(0);
    expect(r.moves[0].accuracyPct).toBeCloseTo(100, 5);
    // Black loses 70cp — above the floor, win-loss from win probability.
    const blackWinLoss = cpToWinPercent(-10) - cpToWinPercent(-80);
    expect(r.moves[1].winLoss).toBeCloseTo(blackWinLoss, 5);
    expect(r.moves[1].accuracyPct).toBeCloseTo(winLossToAccuracy(blackWinLoss), 5);
    // One move each side → player accuracy equals that move's accuracy.
    expect(r.whiteAccuracy).toBeCloseTo(100, 5);
    expect(r.blackAccuracy).toBeCloseTo(winLossToAccuracy(blackWinLoss), 5);
  });

  it('clamps negative CPL to 0 and (non-sacrifice) classifies the move best', async () => {
    vi.mocked(analyze)
      .mockResolvedValueOnce({ depth: 12, bestmove: 'e2e4', pv: ['e2e4'], cp: 10 })
      // Black to move, raw -40 = +40 White-POV: White gained 30cp over the engine line.
      .mockResolvedValueOnce({ depth: 12, bestmove: 'e7e5', pv: ['e7e5'], cp: -40 });

    const { result } = renderHook(() => useMoveClassifier(E4_E5.slice(0, 1)));
    act(() => {
      result.current.run();
    });
    await waitFor(() => expect(result.current.result).not.toBeNull());

    // e4 hangs nothing, so a sub-zero CPL is best — never brilliant.
    expect(result.current.result!.moves[0]).toMatchObject({ cpl: 0, class: 'best' });
    expect(result.current.result!.moves[0].bestUci).toBe('e2e4');
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

  it('tags each move with the side that played it, not ply parity', async () => {
    // Custom start: Black to move (after 1.e4). Ply 1 is therefore a BLACK move,
    // so parity (odd → white) would mislabel it — color must come from the FEN.
    const startFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const moves = [wireMove(1, 'e5', 'e7e5'), wireMove(2, 'Nf3', 'g1f3')];
    vi.mocked(analyze)
      .mockResolvedValueOnce({ depth: 12, bestmove: 'e7e5', pv: ['e7e5'], cp: -20 })
      .mockResolvedValueOnce({ depth: 12, bestmove: 'g1f3', pv: ['g1f3'], cp: 25 })
      .mockResolvedValueOnce({ depth: 12, bestmove: 'b8c6', pv: ['b8c6'], cp: -15 });

    const { result } = renderHook(() => useMoveClassifier(moves, startFen));
    act(() => {
      result.current.run();
    });
    await waitFor(() => expect(result.current.result).not.toBeNull());

    const r = result.current.result!;
    expect(r.moves[0].color).toBe('b');
    expect(r.moves[1].color).toBe('w');
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

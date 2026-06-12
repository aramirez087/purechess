import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePositionEval } from '@/hooks/use-position-eval';
import { analyze, analyzeLines } from '@/lib/engine/stockfish-client';

vi.mock('@/lib/engine/stockfish-client', () => ({
  analyze: vi.fn(),
  analyzeLines: vi.fn(),
}));

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

describe('usePositionEval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('exposes lines[1] when multiPv=2 and routes through analyzeLines', async () => {
    vi.mocked(analyzeLines).mockResolvedValue([
      { depth: 18, bestmove: 'e2e4', pv: ['e2e4', 'e7e5'], cp: 30 },
      { depth: 17, bestmove: 'd2d4', pv: ['d2d4', 'd7d5'], cp: 22 },
    ]);

    const { result } = renderHook(() => usePositionEval(START, true, { multiPv: 2 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(analyzeLines).toHaveBeenCalledWith(START, { movetimeMs: 700, multiPv: 2 });
    expect(analyze).not.toHaveBeenCalled();
    expect(result.current.evaluation).toMatchObject({
      cp: 30,
      bestmove: 'e2e4',
      pv: ['e2e4', 'e7e5'],
    });
    expect(result.current.lines?.[1]).toMatchObject({ cp: 22, pv: ['d2d4', 'd7d5'] });
    expect(result.current.thinking).toBe(false);
  });

  it('normalizes every line to White POV for black-to-move positions', async () => {
    vi.mocked(analyzeLines).mockResolvedValue([
      { depth: 18, bestmove: 'e7e5', pv: ['e7e5'], cp: -25 },
      { depth: 17, bestmove: 'c7c5', pv: ['c7c5'], mate: 4 },
    ]);

    const { result } = renderHook(() => usePositionEval(AFTER_E4, true, { multiPv: 2 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(result.current.evaluation?.cp).toBe(25);
    expect(result.current.lines?.[1]?.mate).toBe(-4);
  });

  it('keeps the single-line analyze path when multiPv is omitted', async () => {
    vi.mocked(analyze).mockResolvedValue({ depth: 12, bestmove: 'e2e4', pv: ['e2e4'], cp: 10 });

    const { result } = renderHook(() => usePositionEval(START, true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(analyzeLines).not.toHaveBeenCalled();
    expect(result.current.evaluation).toMatchObject({ cp: 10, bestmove: 'e2e4', pv: ['e2e4'] });
    expect(result.current.lines).toBeUndefined();
  });
});

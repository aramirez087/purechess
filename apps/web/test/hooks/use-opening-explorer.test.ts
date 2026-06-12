// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { __resetExplorerCache, useOpeningExplorer } from '@/hooks/use-opening-explorer';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';
const D4_FEN = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';

const BOOK_RESPONSE = {
  white: 100,
  draws: 80,
  black: 70,
  moves: [
    { uci: 'd2d4', san: 'd4', white: 20, draws: 20, black: 20, averageRating: 1850 },
    { uci: 'e2e4', san: 'e4', white: 50, draws: 30, black: 20, averageRating: 1800 },
  ],
  opening: { eco: 'A00', name: 'Start' },
};

const EMPTY_RESPONSE = { white: 0, draws: 0, black: 0, moves: [], opening: null };

function okFetch(payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload),
  });
}

/** Fetch mock whose responses resolve only when the test says so. */
function deferredFetch() {
  const pending: Array<{
    url: string;
    signal: AbortSignal | null;
    resolve: (payload: unknown) => void;
  }> = [];
  const fn = vi.fn(
    (url: string, init?: RequestInit) =>
      new Promise((resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
        pending.push({
          url,
          signal: init?.signal ?? null,
          resolve: (payload) =>
            resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) }),
        });
      }),
  );
  return { fn, pending };
}

/** Drains the fetch → json → setState microtask chain. */
async function flushMicrotasks() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

async function settle(ms = 300) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await flushMicrotasks();
  });
}

describe('useOpeningExplorer', () => {
  beforeEach(() => {
    __resetExplorerCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fetches after the debounce, parses percentages, sorts by total', async () => {
    const fetchMock = okFetch(BOOK_RESPONSE);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useOpeningExplorer(START_FEN));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      `https://explorer.lichess.ovh/lichess?fen=${encodeURIComponent(START_FEN)}`,
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.data?.inBook).toBe(true);
    // e4 (total 100) sorts above d4 (total 60) despite response order.
    expect(result.current.data?.moves[0]).toMatchObject({
      uci: 'e2e4',
      san: 'e4',
      total: 100,
      whitePercent: 50,
      drawPercent: 30,
      blackPercent: 20,
    });
    expect(result.current.data?.moves[1]?.uci).toBe('d2d4');
  });

  it('targets the masters endpoint when source is masters', async () => {
    const fetchMock = okFetch(BOOK_RESPONSE);
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useOpeningExplorer(START_FEN, 'masters'));
    await settle();

    expect(String(fetchMock.mock.calls[0][0])).toContain('https://explorer.lichess.ovh/masters?');
  });

  it('serves a repeat FEN from the cache without fetching again', async () => {
    const fetchMock = okFetch(BOOK_RESPONSE);
    vi.stubGlobal('fetch', fetchMock);

    const first = renderHook(() => useOpeningExplorer(START_FEN));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderHook(() => useOpeningExplorer(START_FEN));
    // Cache hit lands synchronously — no debounce wait, no loading flicker.
    expect(second.result.current.data?.inBook).toBe(true);
    expect(second.result.current.loading).toBe(false);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('debounces rapid FEN changes into a single request for the last FEN', async () => {
    const fetchMock = okFetch(BOOK_RESPONSE);
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = renderHook(({ fen }) => useOpeningExplorer(fen), {
      initialProps: { fen: START_FEN },
    });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    rerender({ fen: E4_FEN });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    rerender({ fen: D4_FEN });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(encodeURIComponent(D4_FEN));
  });

  it('aborts the in-flight request on FEN change and ignores its response', async () => {
    const { fn, pending } = deferredFetch();
    vi.stubGlobal('fetch', fn);

    const { result, rerender } = renderHook(({ fen }) => useOpeningExplorer(fen), {
      initialProps: { fen: START_FEN },
    });
    await settle();
    expect(pending).toHaveLength(1);

    rerender({ fen: E4_FEN });
    expect(pending[0].signal?.aborted).toBe(true);
    await settle();
    expect(pending).toHaveLength(2);

    // Old response arrives late — must not reach state.
    await act(async () => {
      pending[0].resolve(EMPTY_RESPONSE);
      await flushMicrotasks();
    });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => {
      pending[1].resolve(BOOK_RESPONSE);
      await flushMicrotasks();
    });
    expect(result.current.data?.inBook).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('reports out of book when moves[] is empty', async () => {
    vi.stubGlobal('fetch', okFetch(EMPTY_RESPONSE));

    const { result } = renderHook(() => useOpeningExplorer(START_FEN));
    await settle();

    expect(result.current.data).toEqual({ moves: [], inBook: false, source: 'lichess' });
    expect(result.current.loading).toBe(false);
  });

  it('resolves to out of book on a fetch error without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { result } = renderHook(() => useOpeningExplorer(START_FEN));
    await settle();

    expect(result.current.data?.inBook).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('resolves to out of book on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: () => Promise.resolve(null) }),
    );

    const { result } = renderHook(() => useOpeningExplorer(START_FEN));
    await settle();

    expect(result.current.data).toEqual({ moves: [], inBook: false, source: 'lichess' });
  });

  it('caps the move list at 5 entries', async () => {
    const many = {
      white: 0,
      draws: 0,
      black: 0,
      moves: Array.from({ length: 8 }, (_, i) => ({
        uci: `a2a${i}`,
        san: `m${i}`,
        white: 10 - i,
        draws: 0,
        black: 0,
        averageRating: 1500,
      })),
      opening: null,
    };
    vi.stubGlobal('fetch', okFetch(many));

    const { result } = renderHook(() => useOpeningExplorer(START_FEN));
    await settle();

    expect(result.current.data?.moves).toHaveLength(5);
  });
});

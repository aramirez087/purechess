// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  epdFromFen,
  lookupOpening,
  useOpeningName,
  __resetOpeningsCache,
} from '@/hooks/use-opening-name';

const SICILIAN_EPD = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPPPPPP/RNBQKBNR w KQkq -';
const SICILIAN_FEN = `${SICILIAN_EPD} 0 2`;
const BOOK: Array<[string, string]> = [[SICILIAN_EPD, 'Sicilian Defense']];

function mockFetch(payload: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(payload),
  });
}

describe('epdFromFen', () => {
  it('keeps the first 4 fields and drops the move counters', () => {
    expect(epdFromFen(SICILIAN_FEN)).toBe(SICILIAN_EPD);
  });

  it('keeps the en passant field when present', () => {
    expect(epdFromFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPPPPPP/RNBQKBNR b KQkq e3 0 1')).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPPPPPP/RNBQKBNR b KQkq e3',
    );
  });
});

describe('lookupOpening', () => {
  const map = new Map(BOOK);

  it('finds a known position', () => {
    expect(lookupOpening(map, SICILIAN_FEN)).toBe('Sicilian Defense');
  });

  it('falls back to a dashed en passant field on a miss', () => {
    const epFen = SICILIAN_EPD.replace('KQkq -', 'KQkq c6') + ' 0 2';
    expect(lookupOpening(map, epFen)).toBe('Sicilian Defense');
  });

  it('returns null for an unknown position', () => {
    expect(lookupOpening(map, '8/8/8/8/8/8/8/K6k w - - 0 1')).toBeNull();
  });
});

describe('useOpeningName', () => {
  beforeEach(() => __resetOpeningsCache());
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves a known position after the book loads', async () => {
    vi.stubGlobal('fetch', mockFetch(BOOK));
    const { result } = renderHook(() => useOpeningName(SICILIAN_FEN));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe('Sicilian Defense'));
  });

  it('returns null for an out-of-book position', async () => {
    const fetchMock = mockFetch(BOOK);
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOpeningName('8/8/8/8/8/8/8/K6k w - - 0 1'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('stays null (and does not throw) when the book fails to load', async () => {
    const fetchMock = mockFetch(null, false);
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOpeningName(SICILIAN_FEN));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});

'use client';

import { useEffect, useState } from 'react';

/**
 * Opening-explorer stats from the free Lichess Explorer API
 * (https://explorer.lichess.ovh) — per-move popularity and win rates for the
 * current position. Read-only, no auth; complements `useOpeningName` (which
 * stays the source of the book-name chip). Results are cached at module scope
 * per `${source}:${fen}` — opening positions are stable, so a position is
 * fetched at most once per session per source.
 */

export type ExplorerSource = 'lichess' | 'masters';

export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  /** white + draws + black */
  total: number;
  /** 0–100 */
  whitePercent: number;
  drawPercent: number;
  blackPercent: number;
  averageRating: number;
}

export interface ExplorerResult {
  moves: ExplorerMove[];
  /** False when the position has no recorded games (out of book). */
  inBook: boolean;
  source: ExplorerSource;
}

interface RawExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating: number;
}

interface RawExplorerResponse {
  moves?: RawExplorerMove[];
}

const EXPLORER_BASE = 'https://explorer.lichess.ovh';
const DEBOUNCE_MS = 300;
const MAX_MOVES = 5;

const cache = new Map<string, ExplorerResult>();

function outOfBook(source: ExplorerSource): ExplorerResult {
  return { moves: [], inBook: false, source };
}

function toResult(raw: RawExplorerResponse | null, source: ExplorerSource): ExplorerResult {
  const rawMoves = Array.isArray(raw?.moves) ? raw.moves : [];
  const moves = rawMoves
    .map((m): ExplorerMove => {
      const total = m.white + m.draws + m.black;
      return {
        uci: m.uci,
        san: m.san,
        white: m.white,
        draws: m.draws,
        black: m.black,
        total,
        whitePercent: total > 0 ? Math.round((m.white / total) * 100) : 0,
        drawPercent: total > 0 ? Math.round((m.draws / total) * 100) : 0,
        blackPercent: total > 0 ? Math.round((m.black / total) * 100) : 0,
        averageRating: m.averageRating,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_MOVES);
  return { moves, inBook: moves.length > 0, source };
}

/**
 * Explorer stats for `fen`, debounced 300ms so rapid move-list navigation
 * doesn't spam the API. In-flight requests abort when the position (or
 * source) changes; an aborted response never reaches state. Network errors
 * resolve to out-of-book without caching, so a blip doesn't hide the
 * explorer for that position all session.
 */
export function useOpeningExplorer(
  fen: string | null,
  source: ExplorerSource = 'lichess',
): { data: ExplorerResult | null; loading: boolean } {
  const [data, setData] = useState<ExplorerResult | null>(() =>
    fen ? (cache.get(`${source}:${fen}`) ?? null) : null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fen) {
      setData(null);
      setLoading(false);
      return;
    }
    const key = `${source}:${fen}`;
    const hit = cache.get(key);
    if (hit) {
      setData(hit);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const url = `${EXPLORER_BASE}/${source}?fen=${encodeURIComponent(fen)}&moves=10&topGames=0&recentGames=0`;
      fetch(url, { signal: controller.signal })
        .then((res) => (res.ok ? (res.json() as Promise<RawExplorerResponse>) : null))
        .then((raw) => {
          if (controller.signal.aborted) return;
          const result = toResult(raw, source);
          cache.set(key, result);
          setData(result);
          setLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setData(outOfBook(source));
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fen, source]);

  return { data, loading };
}

/** Test-only: clears the module-scope cache between specs. */
export function __resetExplorerCache(): void {
  cache.clear();
}

'use client';

import { useEffect, useState } from 'react';

/**
 * Opening-name lookup against the lichess chess-openings book, baked to
 * `/openings.json` ([["epd","name"], …]) by `scripts/build-openings.mjs`.
 * Loaded lazily once per session and cached at module scope (~45 kB gzip).
 */

type OpeningsMap = Map<string, string>;

let cached: OpeningsMap | null = null;
let pending: Promise<OpeningsMap> | null = null;

function loadOpenings(): Promise<OpeningsMap> {
  if (cached) return Promise.resolve(cached);
  pending ??= fetch('/openings.json')
    .then((res) => {
      if (!res.ok) throw new Error(`openings.json ${res.status}`);
      return res.json() as Promise<Array<[string, string]>>;
    })
    .then((entries) => {
      cached = new Map(entries);
      return cached;
    })
    .catch((err) => {
      // Allow a retry on the next mount — a failed fetch must not poison
      // the module-scope cache for the rest of the session.
      pending = null;
      throw err;
    });
  return pending;
}

/** First 4 space-separated FEN fields (drops halfmove + fullmove counters). */
export function epdFromFen(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/**
 * Name of the opening the current position belongs to, or null when out of
 * book (or while the book loads). chess.js omits the en-passant square when
 * no capture is possible while the book may record it — when the exact EPD
 * misses, retry with the ep field dashed out.
 */
export function lookupOpening(map: OpeningsMap, fen: string): string | null {
  const epd = epdFromFen(fen);
  const direct = map.get(epd);
  if (direct) return direct;
  const fields = epd.split(' ');
  if (fields[3] !== '-') {
    fields[3] = '-';
    return map.get(fields.join(' ')) ?? null;
  }
  return null;
}

export function useOpeningName(fen: string): string | null {
  const [map, setMap] = useState<OpeningsMap | null>(cached);

  useEffect(() => {
    if (map) return;
    let disposed = false;
    loadOpenings()
      .then((m) => {
        if (!disposed) setMap(m);
      })
      .catch(() => {
        // Out-of-book UI is the graceful fallback; nothing to surface.
      });
    return () => {
      disposed = true;
    };
  }, [map]);

  return map ? lookupOpening(map, fen) : null;
}

/** Test-only: clears the module-scope cache between specs. */
export function __resetOpeningsCache(): void {
  cached = null;
  pending = null;
}

/**
 * Client for our puzzles API: the daily-puzzle proxy plus the Improve trainer
 * endpoints over our local puzzle bank + per-user puzzle Glicko. The daily
 * shape is re-declared (it mirrors Lichess, not a cross-app DTO); the trainer
 * shapes are the real `@purechess/shared` DTOs.
 */

import type {
  PuzzleAttemptResultDto,
  PuzzleDto,
  PuzzleRatingDto,
  PuzzleSource,
  PuzzleThemeDto,
  PuzzleThemeStatDto,
} from '@purechess/shared';

export interface LichessPuzzleData {
  game: {
    id: string;
    pgn: string;
    players: Array<{ name: string; color: string; rating?: number }>;
  };
  puzzle: {
    id: string;
    initialPly: number;
    solution: string[];
    rating: number;
    plays: number;
    themes: string[];
  };
}

const API = // Production browsers call same-origin '' (the Next /api proxy); dev
  // talks to the API directly.
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');

export async function getDailyPuzzle(): Promise<LichessPuzzleData> {
  const res = await fetch(`${API}/api/puzzles/daily`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw Object.assign(new Error(`puzzle fetch failed: ${res.status}`), { status: res.status });
  }
  return res.json() as Promise<LichessPuzzleData>;
}

// --- Improve trainer endpoints (local puzzle bank) -------------------------
//
// These hit our own bank + per-user puzzle Glicko, so the auth-gated ones carry
// cookies (`credentials: 'include'`). Shapes mirror the server DTOs; the client
// never sets a rating — it reports outcomes and reads back computed values.

async function ensureOk(res: Response, what: string): Promise<Response> {
  if (!res.ok) {
    throw Object.assign(new Error(`${what} failed: ${res.status}`), { status: res.status });
  }
  return res;
}

/** Public theme catalog (slug + count) for the picker / empty-state. */
export async function fetchThemes(): Promise<PuzzleThemeDto[]> {
  const res = await fetch(`${API}/api/puzzles/themes`, {
    headers: { Accept: 'application/json' },
  });
  await ensureOk(res, 'themes fetch');
  return res.json() as Promise<PuzzleThemeDto[]>;
}

/** Next puzzle in the user's rating window (optionally theme-filtered). */
export async function fetchNextPuzzle(
  opts: { theme?: string; rating?: number } = {},
): Promise<PuzzleDto> {
  const params = new URLSearchParams();
  if (opts.theme) params.set('theme', opts.theme);
  if (typeof opts.rating === 'number') params.set('rating', String(opts.rating));
  const qs = params.toString();
  const res = await fetch(`${API}/api/puzzles/next${qs ? `?${qs}` : ''}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'next-puzzle fetch');
  return res.json() as Promise<PuzzleDto>;
}

/** Reports an attempt outcome; returns the server-computed rating move. */
export async function recordAttempt(
  puzzleId: string,
  body: { solved: boolean; msToSolve?: number; source?: PuzzleSource },
): Promise<PuzzleAttemptResultDto> {
  const res = await fetch(`${API}/api/puzzles/${encodeURIComponent(puzzleId)}/attempt`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  await ensureOk(res, 'attempt record');
  return res.json() as Promise<PuzzleAttemptResultDto>;
}

/** Per-theme accuracy for the current user, weakest first. */
export async function fetchPuzzleStats(): Promise<PuzzleThemeStatDto[]> {
  const res = await fetch(`${API}/api/puzzles/stats`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'puzzle-stats fetch');
  return res.json() as Promise<PuzzleThemeStatDto[]>;
}

/** The current user's puzzle Glicko snapshot. */
export async function fetchPuzzleRating(): Promise<PuzzleRatingDto> {
  const res = await fetch(`${API}/api/puzzles/rating`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'puzzle-rating fetch');
  return res.json() as Promise<PuzzleRatingDto>;
}

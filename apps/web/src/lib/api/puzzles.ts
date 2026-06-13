/**
 * Client for our puzzles API: the daily-puzzle proxy plus the Improve trainer
 * endpoints over our local puzzle bank + per-user puzzle Glicko. The daily
 * shape is re-declared (it mirrors Lichess, not a cross-app DTO); the trainer
 * shapes are the real `@purechess/shared` DTOs.
 */

import type {
  GameMistakeDto,
  MistakeCandidateDto,
  PuzzleAttemptResultDto,
  PuzzleDto,
  PuzzleHistoryDto,
  PuzzleRatingDto,
  PuzzleSource,
  PuzzleThemeDto,
  PuzzleThemeStatDto,
  ReviewDueDto,
  ReviewGradeResultDto,
  RushFinishResponseDto,
  RushMode,
  RushPersonalBestsDto,
  RushStartResponseDto,
  SaveMistakesResultDto,
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

/** The current user's puzzle-rating curve (bucketed + capped) + headline summary. */
export async function fetchPuzzleHistory(): Promise<PuzzleHistoryDto> {
  const res = await fetch(`${API}/api/puzzles/history`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'puzzle-history fetch');
  return res.json() as Promise<PuzzleHistoryDto>;
}

// --- Puzzle Rush (timed board-vision drill) --------------------------------

/** Starts a rush run: returns a run id + the escalating-difficulty puzzle set. */
export async function startRush(mode: RushMode = '3min'): Promise<RushStartResponseDto> {
  const res = await fetch(`${API}/api/puzzles/rush/start`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ mode }),
  });
  await ensureOk(res, 'rush start');
  return res.json() as Promise<RushStartResponseDto>;
}

/** Records a finished rush run; returns the personal best + whether it's a PB. */
export async function finishRush(body: {
  mode: RushMode;
  score: number;
  durationMs?: number;
}): Promise<RushFinishResponseDto> {
  const res = await fetch(`${API}/api/puzzles/rush/finish`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  await ensureOk(res, 'rush finish');
  return res.json() as Promise<RushFinishResponseDto>;
}

/** The user's rush personal best per mode (for the pre-run screen). */
export async function fetchRushPersonalBests(): Promise<RushPersonalBestsDto> {
  const res = await fetch(`${API}/api/puzzles/rush/pb`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'rush-pb fetch');
  return res.json() as Promise<RushPersonalBestsDto>;
}

// --- Spaced-repetition review (SM-2 due queue) -----------------------------

/** The user's due-today review queue (oldest-first) + the total due count. */
export async function fetchDueReviews(): Promise<ReviewDueDto> {
  const res = await fetch(`${API}/api/puzzles/review/due`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'review-due fetch');
  return res.json() as Promise<ReviewDueDto>;
}

/** Grade a reviewed card; returns its next due info (or graduation). */
export async function gradeReview(
  puzzleId: string,
  body: { solved: boolean; msToSolve?: number },
): Promise<ReviewGradeResultDto> {
  const res = await fetch(
    `${API}/api/puzzles/review/${encodeURIComponent(puzzleId)}/grade`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    },
  );
  await ensureOk(res, 'review grade');
  return res.json() as Promise<ReviewGradeResultDto>;
}

// --- Mistakes from your own games (S07) ------------------------------------
//
// The client move-classifier flags the user's blunders during game review; we
// POST them once (the endpoint upserts, so it's idempotent). The server
// re-derives every position and keeps only the user's own over-threshold moves
// — the client is never trusted for what it blundered.

/** Persist the user's detected mistakes from a game; returns the saved count. */
export async function saveGameMistakes(
  gameId: string,
  mistakes: MistakeCandidateDto[],
): Promise<SaveMistakesResultDto> {
  const res = await fetch(`${API}/api/games/${encodeURIComponent(gameId)}/mistakes`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ mistakes }),
  });
  await ensureOk(res, 'save mistakes');
  return res.json() as Promise<SaveMistakesResultDto>;
}

/** The user's mistakes (newest first); pass `unreviewedOnly` for the backlog. */
export async function fetchMistakes(unreviewedOnly = false): Promise<GameMistakeDto[]> {
  const qs = unreviewedOnly ? '?unreviewedOnly=true' : '';
  const res = await fetch(`${API}/api/me/mistakes${qs}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'mistakes fetch');
  return res.json() as Promise<GameMistakeDto[]>;
}

/** Mark a mistake reviewed (re-solved); returns the next unreviewed mistake. */
export async function markMistakeReviewed(
  mistakeId: string,
): Promise<{ next: GameMistakeDto | null }> {
  const res = await fetch(
    `${API}/api/me/mistakes/${encodeURIComponent(mistakeId)}/review`,
    {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    },
  );
  await ensureOk(res, 'mistake review');
  return res.json() as Promise<{ next: GameMistakeDto | null }>;
}

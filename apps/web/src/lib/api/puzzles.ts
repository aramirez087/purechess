/**
 * Client for our puzzles API, which proxies + caches Lichess's daily puzzle.
 * The web app fetches from our API (not Lichess directly), so the response
 * type is re-declared here rather than imported from `@purechess/shared`.
 */

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

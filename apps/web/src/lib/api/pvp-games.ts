import type { PvpGameStateDto } from '@purechess/shared';

const API = // Production browsers call same-origin '' (the Next /api proxy);
// dev talks to the API directly.
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(
      new Error((body as { message?: string }).message ?? res.statusText),
      { status: res.status },
    );
  }
  return res.json() as Promise<T>;
}

export function getPvpGame(gameId: string): Promise<PvpGameStateDto> {
  return apiFetch(`/games/${gameId}/state`);
}

export function submitPvpMove(gameId: string, move: string): Promise<PvpGameStateDto> {
  return apiFetch(`/games/${gameId}/move`, {
    method: 'POST',
    body: JSON.stringify({ move }),
  });
}

export function resignPvpGame(gameId: string): Promise<PvpGameStateDto> {
  return apiFetch(`/games/${gameId}/resign`, { method: 'POST' });
}

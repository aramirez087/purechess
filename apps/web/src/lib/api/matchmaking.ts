import type {
  MatchmakingJoinRequestDto,
  MatchmakingJoinResponseDto,
  MatchmakingStatusDto,
} from '@purechess/shared';

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
    throw Object.assign(new Error((body as { message?: string }).message ?? res.statusText), {
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}

export function joinMatchmaking(
  params: MatchmakingJoinRequestDto,
): Promise<MatchmakingJoinResponseDto> {
  return apiFetch('/matchmaking/join', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function leaveMatchmaking(): Promise<{ ok: boolean }> {
  return apiFetch('/matchmaking/leave', { method: 'POST' });
}

export function getMatchmakingStatus(): Promise<MatchmakingStatusDto> {
  return apiFetch('/matchmaking/status');
}

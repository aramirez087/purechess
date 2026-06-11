import type { SafeUser } from '@purechess/shared';

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
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw Object.assign(new Error(message ?? res.statusText), { status: res.status });
  }
  return res.json() as Promise<T>;
}

export interface AuthResponse {
  user: SafeUser;
}

export function register(dto: {
  email: string;
  username: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(dto) });
}

export function login(dto: {
  emailOrUsername: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(dto) });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiFetch('/auth/logout', { method: 'POST' });
}

/** 200 {user: null} when unauthenticated — never a 401. */
export function getMe(): Promise<{ user: SafeUser | null }> {
  return apiFetch('/auth/me');
}

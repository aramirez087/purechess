const API = // Production browsers call same-origin '' (the Next /api proxy);
// dev talks to the API directly.
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api/admin${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message ?? res.statusText), { status: res.status });
  }
  return res.json() as Promise<T>;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  isDisabled: boolean;
  isAdmin: boolean;
  ratings: { category: string; rating: number }[];
}

export interface AdminFairPlaySignal {
  id: string;
  userId: string;
  gameId: string | null;
  signalType: string;
  score: number;
  payload: unknown;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUser {
  oauthAccounts: { provider: string; createdAt: string }[];
  fairPlaySignals: AdminFairPlaySignal[];
  _count: { gamesAsWhite: number; gamesAsBlack: number; reportsReceived: number };
}

export interface AdminGame {
  id: string;
  category: string;
  timeControlSeconds: number;
  incrementSeconds: number;
  isRated: boolean;
  status: string;
  result: string | null;
  resultReason: string | null;
  endedAt: string | null;
  createdAt: string;
  whitePlayer: { id: string; username: string };
  blackPlayer: { id: string; username: string };
}

export interface AdminGameDetail extends AdminGame {
  moves: { id: string; ply: number; san: string; uci: string; fenAfterMove: string; clockAfterMoveMs: number; moveTimeMs: number }[];
  fairPlaySignals: { id: string; signalType: string; score: number; payload: unknown }[];
}

export interface AuditLog {
  id: string;
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  payload: unknown;
  createdAt: string;
  admin: { id: string; username: string };
}

export interface Paginated<T> {
  page: number;
  pageSize: number;
  total: number;
  users?: T[];
  games?: T[];
  logs?: T[];
}

export function fetchUsers(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return apiFetch<Paginated<AdminUser>>(`/users${qs ? `?${qs}` : ''}`);
}

export function fetchUser(id: string) {
  return apiFetch<AdminUserDetail>(`/users/${id}`);
}

export function disableUser(id: string, reason: string) {
  return apiFetch<{ ok: boolean }>(`/users/${id}/disable`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function enableUser(id: string) {
  return apiFetch<{ ok: boolean }>(`/users/${id}/enable`, { method: 'POST' });
}

export function fetchGames(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return apiFetch<Paginated<AdminGame>>(`/games${qs ? `?${qs}` : ''}`);
}

export function fetchGame(id: string) {
  return apiFetch<AdminGameDetail>(`/games/${id}`);
}

export function fetchQueues() {
  return apiFetch<{ buckets: Record<string, { count: number; oldestWaitMs: number }> }>('/queues');
}

export function fetchActiveGames() {
  return apiFetch<{ count: number; sample: AdminGame[] }>('/active-games');
}

export function fetchAudit(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return apiFetch<Paginated<AuditLog>>(`/audit${qs ? `?${qs}` : ''}`);
}

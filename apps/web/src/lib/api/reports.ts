const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error((body as { message?: string }).message ?? res.statusText), { status: res.status });
  }
  return res.json() as Promise<T>;
}

export interface Report {
  id: string;
  reporterUserId: string;
  reportedUserId: string;
  gameId: string | null;
  reason: string;
  notes: string | null;
  status: 'open' | 'reviewed' | 'dismissed';
  createdAt: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
}

export interface FairPlaySignal {
  id: string;
  userId: string;
  gameId: string | null;
  signalType: string;
  score: number;
  payload: unknown;
  createdAt: string;
}

export interface AdminReportRow extends Report {
  reporter: { id: string; username: string };
  reported: { id: string; username: string };
  reviewedBy: { id: string; username: string } | null;
  game: { id: string; category: string; status: string } | null;
  relatedCount: number;
}

export interface RecentGame {
  id: string;
  category: string;
  status: string;
  result: string | null;
  createdAt: string;
  whitePlayer?: { id: string; username: string };
  blackPlayer?: { id: string; username: string };
}

export interface ReportDetail extends AdminReportRow {
  game: {
    id: string;
    category: string;
    status: string;
    result: string | null;
    resultReason: string | null;
    whitePlayer: { id: string; username: string };
    blackPlayer: { id: string; username: string };
  } | null;
  reportedUserSignals: FairPlaySignal[];
  reportedUserRecentGames: RecentGame[];
}

export interface PaginatedReports {
  reports: AdminReportRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreateReportBody {
  reportedUserId: string;
  gameId?: string;
  reason: string;
  notes?: string;
}

export function createReport(body: CreateReportBody): Promise<{ created: boolean; report: Report }> {
  return apiFetch('/reports', { method: 'POST', body: JSON.stringify(body) });
}

export function fetchMyReports(): Promise<Report[]> {
  return apiFetch('/reports/me');
}

export function fetchAdminReports(params: Record<string, string>): Promise<PaginatedReports> {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/admin/reports${qs ? `?${qs}` : ''}`);
}

export function fetchAdminReport(id: string): Promise<ReportDetail> {
  return apiFetch(`/admin/reports/${id}`);
}

export function updateReportStatus(
  id: string,
  body: { status: 'reviewed' | 'dismissed'; notes?: string },
): Promise<Report> {
  return apiFetch(`/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

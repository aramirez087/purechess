/**
 * Shared browser → API plumbing for every `lib/api/*` client.
 *
 * `API_BASE` is the origin: production browsers call same-origin '' (the Next
 * `/api` proxy → first-party cookie, no CORS preflight); dev talks to the API
 * directly. `apiFetch` is the JSON request helper (returns parsed `T`);
 * `ensureOk` validates a `Response` you fetched yourself (returns it so you can
 * read the body once). Both throw an `Error` with a `.status` number attached.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');

/** Pull a human message out of a JSON error body (NestJS sends string | string[]). */
function messageFrom(body: unknown, fallback: string): string {
  const m = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(m)) return m.join('; ') || fallback;
  return m ?? fallback;
}

/** JSON fetch against `${API_BASE}/api${path}`; resolves the parsed body or throws. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(messageFrom(body, res.statusText)), { status: res.status });
  }
  return res.json() as Promise<T>;
}

/** Throw on a non-ok `Response` (with `.status`); otherwise return it unread. */
export async function ensureOk(res: Response, what: string): Promise<Response> {
  if (!res.ok) {
    const body = await res
      .clone()
      .json()
      .catch(() => ({}));
    throw Object.assign(new Error(messageFrom(body, `${what} failed: ${res.status}`)), {
      status: res.status,
    });
  }
  return res;
}

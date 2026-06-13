/**
 * Client for the training / insights API (`/train`).
 *
 * `fetchInsights` returns the user's evidence-backed, ranked weakness list. It
 * is auth-gated, so the call carries the session cookie. Used by the
 * `/train/insights` page (server-side via `serverFetch`, or client-side here).
 */
import type { InsightDto } from '@purechess/shared';

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');

async function ensureOk(res: Response, what: string): Promise<Response> {
  if (!res.ok) {
    let message = `${what} failed: ${res.status}`;
    try {
      const body = (await res.clone().json()) as { message?: string | string[] };
      if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join('; ') : body.message;
      }
    } catch {
      // non-JSON body — keep the status message
    }
    throw Object.assign(new Error(message), { status: res.status });
  }
  return res;
}

/** The signed-in user's ranked weaknesses + headline recommendation. */
export async function fetchInsights(): Promise<InsightDto> {
  const res = await fetch(`${API}/api/train/insights`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  await ensureOk(res, 'fetchInsights');
  return (await res.json()) as InsightDto;
}

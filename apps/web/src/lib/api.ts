import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type FetchOptions = {
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  withAuth?: boolean;
};

export async function serverFetch<T>(path: string, opts: FetchOptions = {}): Promise<T | null> {
  const { cache, next, withAuth = false } = opts;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (withAuth) {
    const cookieStore = await cookies();
    const session = cookieStore.get('purchess_session');
    if (session) {
      headers['Cookie'] = `purchess_session=${session.value}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...(cache && { cache }),
    ...(next && { next }),
  });

  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

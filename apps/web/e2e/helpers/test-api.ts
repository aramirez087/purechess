const API_URL = process.env['API_URL'] ?? 'http://localhost:4000';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  sessionToken: string;
}

export interface TestGame {
  id: string;
}

export async function createTestUser(opts: {
  username: string;
  email: string;
  isAdmin?: boolean;
}): Promise<TestUser> {
  const res = await fetch(`${API_URL}/api/testing/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`createTestUser failed: ${res.status}`);
  return res.json() as Promise<TestUser>;
}

export async function createTestGame(opts: {
  whiteUserId?: string;
  blackUserId?: string;
  status?: string;
  timeControlSeconds?: number;
  incrementSeconds?: number;
  category?: string;
  isRated?: boolean;
}): Promise<TestGame> {
  const res = await fetch(`${API_URL}/api/testing/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`createTestGame failed: ${res.status}`);
  return res.json() as Promise<TestGame>;
}

export async function createTestComputerGame(opts: {
  sessionToken: string;
  fen: string;
  color: 'white' | 'black';
  level?: number;
  timeControlSeconds?: number;
}): Promise<TestGame> {
  const res = await fetch(`${API_URL}/api/computer-games/from-fen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `purechess_session=${opts.sessionToken}`,
    },
    body: JSON.stringify({
      level: opts.level ?? 1,
      color: opts.color,
      timeControlSeconds: opts.timeControlSeconds ?? 0,
      fen: opts.fen,
    }),
  });
  if (!res.ok) throw new Error(`createTestComputerGame failed: ${res.status}`);
  const data = (await res.json()) as { gameId: string };
  return { id: data.gameId };
}

export async function resetTestDb(): Promise<void> {
  const res = await fetch(`${API_URL}/api/testing/reset`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`reset failed: ${res.status}`);
}

export function sessionCookie(token: string): string {
  return `purechess_session=${token}`;
}

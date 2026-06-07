import type { CreateComputerGameDto, ComputerGameStateDto } from '@purchess/shared';

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

export function createComputerGame(dto: CreateComputerGameDto): Promise<ComputerGameStateDto> {
  return apiFetch('/computer-games', { method: 'POST', body: JSON.stringify(dto) });
}

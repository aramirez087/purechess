import type {
  CreateComputerGameDto,
  ComputerGameStateDto,
  TakebackDto,
  RewindToPlyDto,
  AbortDto,
  DrawActionDto,
  RematchDto,
  CreateFromFenDto,
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
    throw Object.assign(new Error((body as { message?: string }).message ?? res.statusText), { status: res.status });
  }
  return res.json() as Promise<T>;
}

export function createComputerGame(dto: CreateComputerGameDto): Promise<ComputerGameStateDto> {
  return apiFetch('/computer-games', { method: 'POST', body: JSON.stringify(dto) });
}

export function getComputerGame(gameId: string): Promise<ComputerGameStateDto> {
  return apiFetch(`/computer-games/${gameId}`);
}

export function submitComputerMove(gameId: string, move: string): Promise<ComputerGameStateDto> {
  return apiFetch(`/computer-games/${gameId}/move`, {
    method: 'POST',
    body: JSON.stringify({ move }),
  });
}

export function takebackComputerMove(gameId: string, plies: 1 | 2): Promise<ComputerGameStateDto> {
  return apiFetch(`/computer-games/${gameId}/takeback`, {
    method: 'POST',
    body: JSON.stringify({ plies } satisfies TakebackDto),
  });
}

export function rewindComputerGame(gameId: string, ply: number): Promise<ComputerGameStateDto> {
  return apiFetch(`/computer-games/${gameId}/rewind`, {
    method: 'POST',
    body: JSON.stringify({ ply } satisfies RewindToPlyDto),
  });
}

export function abortComputerGame(gameId: string): Promise<ComputerGameStateDto> {
  return apiFetch(`/computer-games/${gameId}/abort`, {
    method: 'POST',
    body: JSON.stringify({} satisfies AbortDto),
  });
}

export function drawComputerGame(
  gameId: string,
  action: DrawActionDto['action'],
): Promise<ComputerGameStateDto> {
  return apiFetch(`/computer-games/${gameId}/draw`, {
    method: 'POST',
    body: JSON.stringify({ action } satisfies DrawActionDto),
  });
}

export function rematchComputerGame(
  gameId: string,
  swapColors?: boolean,
): Promise<ComputerGameStateDto> {
  return apiFetch(`/computer-games/${gameId}/rematch`, {
    method: 'POST',
    body: JSON.stringify({ swapColors } satisfies RematchDto),
  });
}

export function createComputerGameFromFen(
  payload: CreateFromFenDto,
): Promise<ComputerGameStateDto> {
  return apiFetch('/computer-games/from-fen', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

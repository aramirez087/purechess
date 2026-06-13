import type { PvpGameStateDto } from '@purechess/shared';
import { apiFetch } from './client';

export function getPvpGame(gameId: string): Promise<PvpGameStateDto> {
  return apiFetch(`/games/${gameId}/state`);
}

export function submitPvpMove(gameId: string, move: string): Promise<PvpGameStateDto> {
  return apiFetch(`/games/${gameId}/move`, {
    method: 'POST',
    body: JSON.stringify({ move }),
  });
}

export function resignPvpGame(gameId: string): Promise<PvpGameStateDto> {
  return apiFetch(`/games/${gameId}/resign`, { method: 'POST' });
}

export function drawPvpGame(
  gameId: string,
  action: 'offer' | 'accept' | 'decline' | 'claim',
): Promise<PvpGameStateDto> {
  return apiFetch(`/games/${gameId}/draw`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export function abortPvpGame(gameId: string): Promise<PvpGameStateDto> {
  return apiFetch(`/games/${gameId}/abort`, { method: 'POST' });
}

export function rematchPvpGame(
  gameId: string,
  action: 'offer' | 'accept' | 'decline',
): Promise<PvpGameStateDto> {
  return apiFetch(`/games/${gameId}/rematch`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

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
import { apiFetch } from './client';

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

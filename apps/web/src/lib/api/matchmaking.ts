import type {
  MatchmakingJoinRequestDto,
  MatchmakingJoinResponseDto,
  MatchmakingStatusDto,
} from '@purechess/shared';
import { apiFetch } from './client';

export function joinMatchmaking(
  params: MatchmakingJoinRequestDto,
): Promise<MatchmakingJoinResponseDto> {
  return apiFetch('/matchmaking/join', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function leaveMatchmaking(): Promise<{ ok: boolean }> {
  return apiFetch('/matchmaking/leave', { method: 'POST' });
}

export function getMatchmakingStatus(): Promise<MatchmakingStatusDto> {
  return apiFetch('/matchmaking/status');
}

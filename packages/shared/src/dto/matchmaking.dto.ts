export type MatchmakingCategory = 'bullet' | 'blitz' | 'rapid';

export interface MatchmakingTimeControl {
  /** Display label, e.g. '3+0'. */
  label: string;
  /** Display sub-label, e.g. 'Blitz'. */
  sub: string;
  seconds: number;
  increment: number;
  category: MatchmakingCategory;
}

/**
 * The preset quick-match pools. Join requests must match one exactly — the
 * whitelist bounds the set of Redis queue keys, and the web setup renders its
 * pills from this same list so API and UI can never drift.
 */
export const MATCHMAKING_TIME_CONTROLS: readonly MatchmakingTimeControl[] = [
  { label: '1+0', sub: 'Bullet', seconds: 60, increment: 0, category: 'bullet' },
  { label: '2+1', sub: 'Bullet', seconds: 120, increment: 1, category: 'bullet' },
  { label: '3+0', sub: 'Blitz', seconds: 180, increment: 0, category: 'blitz' },
  { label: '5+0', sub: 'Blitz', seconds: 300, increment: 0, category: 'blitz' },
  { label: '5+3', sub: 'Blitz', seconds: 300, increment: 3, category: 'blitz' },
  { label: '10+0', sub: 'Rapid', seconds: 600, increment: 0, category: 'rapid' },
  { label: '15+10', sub: 'Rapid', seconds: 900, increment: 10, category: 'rapid' },
];

export interface MatchmakingJoinRequestDto {
  timeControlSeconds: number;
  incrementSeconds: number;
  category: MatchmakingCategory;
  /** Quick match defaults to rated (the UI always sends it explicitly). */
  rated?: boolean;
}

export interface MatchmakingJoinResponseDto {
  /** 'matched' when a compatible opponent was waiting — gameId is set. */
  status: 'queued' | 'matched';
  gameId?: string;
}

export interface MatchmakingStatusDto {
  status: 'idle' | 'queued' | 'matched';
  gameId?: string;
  waitSeconds?: number;
}

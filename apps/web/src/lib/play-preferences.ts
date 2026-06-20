import { MATCHMAKING_TIME_CONTROLS, type MatchmakingTimeControl } from '@purechess/shared';

/** Default quick-match pool: 3+0 blitz — the most common online tempo. */
export const DEFAULT_TIME_CONTROL_INDEX = 2;

export interface PlayPreferences {
  timeControlIndex: number;
  rated: boolean;
}

export const DEFAULT_PLAY_PREFERENCES: PlayPreferences = {
  timeControlIndex: DEFAULT_TIME_CONTROL_INDEX,
  rated: true,
};

export function clampTimeControlIndex(index: number): number {
  if (!Number.isFinite(index)) return DEFAULT_TIME_CONTROL_INDEX;
  return Math.max(0, Math.min(MATCHMAKING_TIME_CONTROLS.length - 1, Math.trunc(index)));
}

export function resolveTimeControl(index: number): MatchmakingTimeControl {
  return MATCHMAKING_TIME_CONTROLS[clampTimeControlIndex(index)]!;
}

export function formatPlayPrefsLabel(prefs: PlayPreferences): string {
  const tc = resolveTimeControl(prefs.timeControlIndex);
  const stakes = prefs.rated ? 'Rated' : 'Casual';
  return `${tc.sub} ${tc.label} · ${stakes}`;
}
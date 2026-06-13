/**
 * Client for the training hub / insights API (`/train`).
 *
 * `fetchInsights` returns the user's evidence-backed, ranked weakness list;
 * `fetchTrainingPlan` / `fetchStreak` / `setTrainingGoal` drive the /train hub.
 * All are auth-gated, so each call carries the session cookie.
 */
import type {
  InsightDto,
  TrainingPlanDto,
  TrainingStreakDto,
} from '@purechess/shared';
import { API_BASE as API, ensureOk } from './client';

/** The signed-in user's ranked weaknesses + headline recommendation. */
export async function fetchInsights(): Promise<InsightDto> {
  const res = await fetch(`${API}/api/train/insights`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  await ensureOk(res, 'fetchInsights');
  return (await res.json()) as InsightDto;
}

/** Today's ~10-minute training plan with live done/target progress. */
export async function fetchTrainingPlan(): Promise<TrainingPlanDto> {
  const res = await fetch(`${API}/api/train/plan`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  await ensureOk(res, 'fetchTrainingPlan');
  return (await res.json()) as TrainingPlanDto;
}

/** The user's streak snapshot + recent training days for the calendar. */
export async function fetchStreak(): Promise<TrainingStreakDto> {
  const res = await fetch(`${API}/api/train/streak`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  await ensureOk(res, 'fetchStreak');
  return (await res.json()) as TrainingStreakDto;
}

/** Set the daily puzzle goal (server clamps 1..50). Returns the fresh streak. */
export async function setTrainingGoal(dailyGoalPuzzles: number): Promise<TrainingStreakDto> {
  const res = await fetch(`${API}/api/train/goal`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ dailyGoalPuzzles }),
  });
  await ensureOk(res, 'setTrainingGoal');
  return (await res.json()) as TrainingStreakDto;
}

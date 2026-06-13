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

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');

async function ensureOk(res: Response, what: string): Promise<Response> {
  if (!res.ok) {
    let message = `${what} failed: ${res.status}`;
    try {
      const body = (await res.clone().json()) as { message?: string | string[] };
      if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join('; ') : body.message;
      }
    } catch {
      // non-JSON body — keep the status message
    }
    throw Object.assign(new Error(message), { status: res.status });
  }
  return res;
}

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

/**
 * training-events.ts — the single, documented taxonomy for the Improve/Training
 * funnel (PostHog). Every training surface fires events through THIS module so
 * names stay consistent and the event set is discoverable in one place.
 *
 * Consent: these all route through the existing `posthog` wrapper (`@/lib/posthog`),
 * which is gated on `navigator.doNotTrack` / Global Privacy Control and the
 * presence of `NEXT_PUBLIC_POSTHOG_KEY` (see lib/posthog.ts). When PostHog is
 * not initialized (opt-out, missing key, SSR) `posthog.capture` is a safe no-op,
 * so callers never have to guard. We never introduce a second analytics client.
 *
 * The full documented event set (props in braces):
 *   training_plan_viewed            — the /train hub plan rendered with ≥1 item
 *   puzzle_started   { source }     — a solve loop began on a puzzle
 *   puzzle_solved    { source, theme, rating } — correct solve
 *   puzzle_failed    { source, theme, rating } — incorrect / gave up
 *   rush_run_finished{ mode, score }
 *   review_session_completed { count }
 *   opening_drill_completed { lines, accuracy }
 *   endgame_attempt  { slug, succeeded }
 *   insight_viewed   { kind }
 *   insight_action_clicked { kind }
 *   streak_advanced  { n }
 *
 * `source` is the `PuzzleSource` union ('daily'|'theme'|'rush'|'review'|'mistake').
 * Keep this list and docs/roadmap/purechess-improve/epic-closeout.md in sync.
 */
import type { PuzzleSource } from '@purechess/shared';

/** Lazily load the posthog singleton (mirrors the rest of the app). */
function capture(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  // Fire-and-forget; the wrapper itself is consent-gated and no-ops when off.
  void import('@/lib/posthog')
    .then(({ posthog }) => {
      posthog.capture(event, properties);
    })
    .catch(() => {
      /* analytics must never break the UX */
    });
}

export const TRAINING_EVENTS = {
  TRAINING_PLAN_VIEWED: 'training_plan_viewed',
  PUZZLE_STARTED: 'puzzle_started',
  PUZZLE_SOLVED: 'puzzle_solved',
  PUZZLE_FAILED: 'puzzle_failed',
  RUSH_RUN_FINISHED: 'rush_run_finished',
  REVIEW_SESSION_COMPLETED: 'review_session_completed',
  OPENING_DRILL_COMPLETED: 'opening_drill_completed',
  ENDGAME_ATTEMPT: 'endgame_attempt',
  INSIGHT_VIEWED: 'insight_viewed',
  INSIGHT_ACTION_CLICKED: 'insight_action_clicked',
  STREAK_ADVANCED: 'streak_advanced',
} as const;

export function trainingPlanViewed(itemCount: number): void {
  capture(TRAINING_EVENTS.TRAINING_PLAN_VIEWED, { itemCount });
}

export function puzzleStarted(source: PuzzleSource, theme?: string | null): void {
  capture(TRAINING_EVENTS.PUZZLE_STARTED, { source, theme: theme ?? null });
}

export function puzzleSolved(opts: {
  source: PuzzleSource;
  theme?: string | null;
  rating?: number | null;
}): void {
  capture(TRAINING_EVENTS.PUZZLE_SOLVED, {
    source: opts.source,
    theme: opts.theme ?? null,
    rating: opts.rating ?? null,
  });
}

export function puzzleFailed(opts: {
  source: PuzzleSource;
  theme?: string | null;
  rating?: number | null;
}): void {
  capture(TRAINING_EVENTS.PUZZLE_FAILED, {
    source: opts.source,
    theme: opts.theme ?? null,
    rating: opts.rating ?? null,
  });
}

export function rushRunFinished(mode: string, score: number): void {
  capture(TRAINING_EVENTS.RUSH_RUN_FINISHED, { mode, score });
}

export function reviewSessionCompleted(count: number): void {
  capture(TRAINING_EVENTS.REVIEW_SESSION_COMPLETED, { count });
}

export function openingDrillCompleted(opts: { lines: number; accuracy: number }): void {
  capture(TRAINING_EVENTS.OPENING_DRILL_COMPLETED, opts);
}

export function endgameAttempt(slug: string, succeeded: boolean): void {
  capture(TRAINING_EVENTS.ENDGAME_ATTEMPT, { slug, succeeded });
}

export function insightViewed(kind: string): void {
  capture(TRAINING_EVENTS.INSIGHT_VIEWED, { kind });
}

export function insightActionClicked(kind: string): void {
  capture(TRAINING_EVENTS.INSIGHT_ACTION_CLICKED, { kind });
}

export function streakAdvanced(n: number): void {
  capture(TRAINING_EVENTS.STREAK_ADVANCED, { n });
}

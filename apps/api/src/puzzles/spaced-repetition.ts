/**
 * Pure SM-2-style spaced-repetition scheduler for failed/learning puzzles.
 *
 * No DB, no side effects, fully deterministic — every output is a function of
 * the previous card state plus the grade. The {@link PuzzleReviewService} owns
 * persistence; this module owns the arithmetic, so it can be unit-tested in
 * isolation and reused unchanged by any future review surface (S07 mistakes).
 *
 * The model is the classic SuperMemo-2 algorithm, simplified to three grades
 * (the only ones a binary solve/fail outcome can yield):
 *
 *   - `again` — the user failed the puzzle. The card lapses: reps reset to 0,
 *     lapses increment, the interval collapses back to ~1 day, and the ease
 *     factor is penalised (floored at {@link MIN_EASE}). This is the whole point
 *     of the queue — a failed card comes back tomorrow.
 *   - `good`  — solved at a normal pace. reps increment; the interval follows
 *     the SM-2 ladder: first success → {@link FIRST_INTERVAL_DAYS} (1d), second
 *     → {@link SECOND_INTERVAL_DAYS} (6d), thereafter previous × ease. Ease is
 *     essentially unchanged (a tiny `good` nudge keeps mature cards from drifting
 *     down forever).
 *   - `easy`  — solved fast/confidently. Same reps progression as `good` but the
 *     interval gets an extra {@link EASY_BONUS} multiplier and the ease factor is
 *     bumped by {@link EASY_EASE_BONUS}. Learned puzzles graduate out faster.
 *
 * Constants follow SM-2 conventions (Anki's defaults are the de-facto standard):
 *   - starting ease 2.5, ease floor 1.3
 *   - first/second fixed intervals 1d / 6d
 *   - `again` penalty −0.20 ease, `good` +0.0 (held), `easy` +0.15 ease
 *   - `easy` interval bonus ×1.3
 */

/** Starting ease factor for a brand-new card (SM-2 default). */
export const DEFAULT_EASE = 2.5;

/** Lower bound on the ease factor — SM-2 never lets a card drop below this. */
export const MIN_EASE = 1.3;

/** Interval (days) after the FIRST successful review of a learning card. */
export const FIRST_INTERVAL_DAYS = 1;

/** Interval (days) after the SECOND successful review. */
export const SECOND_INTERVAL_DAYS = 6;

/** Interval (days) a failed card collapses back to. */
export const LAPSE_INTERVAL_DAYS = 1;

/** Ease penalty applied on a lapse (`again`). */
export const AGAIN_EASE_PENALTY = 0.2;

/** Ease nudge applied on a normal success (`good`) — held flat. */
export const GOOD_EASE_DELTA = 0;

/** Ease bonus applied on a confident success (`easy`). */
export const EASY_EASE_BONUS = 0.15;

/** Extra interval multiplier applied on `easy` (on top of × ease). */
export const EASY_BONUS = 1.3;

/** The three grades a binary solve/fail outcome can map to. */
export type ReviewGrade = 'again' | 'good' | 'easy';

/** The persisted, schedulable part of a {@link PuzzleReview} row. */
export interface CardState {
  /** Current scheduling interval in whole days. */
  intervalDays: number;
  /** SM-2 ease factor (≥ {@link MIN_EASE}). */
  easeFactor: number;
  /** Consecutive successful reviews (reset to 0 on a lapse). */
  reps: number;
  /** Total times this card has been failed. */
  lapses: number;
}

/** A scheduler decision: the next card state plus when it is next due. */
export interface ScheduleResult extends CardState {
  /** Days from "now" until the card is next due (== {@link CardState.intervalDays}). */
  nextDueOffsetDays: number;
}

/** Clamp the ease factor to the SM-2 floor; round to avoid float drift. */
function clampEase(ease: number): number {
  return Math.round(Math.max(MIN_EASE, ease) * 100) / 100;
}

/**
 * Pure SM-2 step. Given the previous card state and a grade, returns the next
 * state and the offset (in days) at which the card becomes due again.
 *
 * Deterministic: identical inputs always yield identical outputs. Intervals are
 * whole days (rounded), never below 1.
 */
export function schedule(prev: CardState, grade: ReviewGrade): ScheduleResult {
  // --- Lapse: the user failed. Reset the learning progress. ----------------
  if (grade === 'again') {
    const easeFactor = clampEase(prev.easeFactor - AGAIN_EASE_PENALTY);
    const next: CardState = {
      intervalDays: LAPSE_INTERVAL_DAYS,
      easeFactor,
      reps: 0,
      lapses: prev.lapses + 1,
    };
    return { ...next, nextDueOffsetDays: next.intervalDays };
  }

  // --- Success (good | easy). Advance reps and the interval ladder. --------
  const reps = prev.reps + 1;
  const easeDelta = grade === 'easy' ? EASY_EASE_BONUS : GOOD_EASE_DELTA;
  const easeFactor = clampEase(prev.easeFactor + easeDelta);

  let intervalDays: number;
  if (reps === 1) {
    intervalDays = FIRST_INTERVAL_DAYS;
  } else if (reps === 2) {
    intervalDays = SECOND_INTERVAL_DAYS;
  } else {
    // Mature card: grow by the (post-update) ease factor.
    intervalDays = Math.round(prev.intervalDays * easeFactor);
  }

  // `easy` gets an extra bonus multiplier on top of the ladder.
  if (grade === 'easy') {
    intervalDays = Math.round(intervalDays * EASY_BONUS);
  }

  // Never schedule sooner than the next day.
  intervalDays = Math.max(1, intervalDays);

  const next: CardState = { intervalDays, easeFactor, reps, lapses: prev.lapses };
  return { ...next, nextDueOffsetDays: next.intervalDays };
}

/**
 * A tiny injectable clock so time-dependent training logic (streak day
 * boundaries) is testable. Production binds {@link SYSTEM_CLOCK}; specs bind a
 * pinned clock to drive "yesterday / today / a gap" without sleeping.
 *
 * The streak math is UTC-day-based (see `StreakService`), so the clock only
 * needs to return the current instant; the day key is derived from it.
 */
export const CLOCK = 'TRAINING_CLOCK';

/** Returns the current instant. */
export interface Clock {
  now(): Date;
}

/** The real wall clock used in production. */
export const SYSTEM_CLOCK: Clock = {
  now: () => new Date(),
};

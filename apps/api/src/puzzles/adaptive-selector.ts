/**
 * Adaptive difficulty + theme-interleave policy.
 *
 * These are PURE functions over a window of recent results. They contain no DB
 * access and no side effects, so they unit-test in isolation and can be wired
 * into `PuzzleServingService.getNext` as an *optional* policy layer: with an
 * EMPTY history every function is a no-op (it returns the input target / a null
 * theme), so the default serving behavior is byte-for-byte the same as S03.
 *
 * ---------------------------------------------------------------------------
 * THE CONTROL LAW (nextDifficulty)
 * ---------------------------------------------------------------------------
 * Goal: keep the user in the *productive struggle* zone — roughly 75-85%
 * success. Below that band puzzles are too hard (frustration, no learning);
 * above it they are too easy (no struggle, no learning). We steer the target
 * rating toward the band using a damped proportional controller:
 *
 *   error      = observedSuccess - TARGET_SUCCESS            (TARGET_SUCCESS = 0.80)
 *   rawStep    = error * GAIN                                (GAIN = 800)
 *   speedBonus = fast-solve streak nudge (see below)
 *   step       = clamp(rawStep + speedBonus, -MAX_STEP, +MAX_STEP)  (MAX_STEP = 60)
 *   next       = clamp(current + step, anchor - BAND, anchor + BAND)
 *
 * - PROPORTIONAL: the further success sits from 80%, the bigger the correction.
 *   A user solving 100% (error +0.20) gets pushed up; one solving 40% (error
 *   -0.40) gets eased down harder.
 * - DAMPED: `MAX_STEP` caps any single adjustment at 60 Elo so a couple of lucky
 *   or unlucky puzzles can't swing difficulty wildly. The controller is
 *   *gradient-following*, not a setpoint jump.
 * - SPEED-AWARE: a streak of FAST solves (all solved AND every solve under
 *   {@link FAST_SOLVE_MS}) adds a small upward nudge ({@link SPEED_BONUS}) on top
 *   of the proportional term — fast, clean solving is the clearest "too easy"
 *   signal. Consecutive FAILS at the tail of the window add a downward nudge so
 *   we ease off quickly when the user is stuck, without waiting for the success
 *   rate to average down.
 * - BOUNDED: the result is clamped to `anchor ± BAND` (BAND = 300) where the
 *   anchor is the user's own puzzle rating. Difficulty tracks performance but
 *   can never drift more than ~300 Elo from where the user actually sits.
 *
 * ---------------------------------------------------------------------------
 * FIRST-RUN CALIBRATION
 * ---------------------------------------------------------------------------
 * A brand-new user has no reliable rating yet, so we *widen the search band* and
 * *vary* the offered difficulty to triangulate their level fast. While the user
 * has fewer than {@link CALIBRATION_ATTEMPTS} (= 8) recorded attempts we are in
 * the calibration window: {@link calibrationBand} returns a wider half-window
 * than the steady-state ladder's first tier, and {@link nextDifficulty} reacts
 * more aggressively (a larger gain) so a few solves/fails move the estimate a
 * long way. Once the user crosses the window we settle into the damped law
 * above.
 */

/** A single recent attempt the policy reasons over. */
export interface RecentResult {
  /** Whether the user solved this puzzle. */
  solved: boolean;
  /** Milliseconds the user took (omit/undefined when not measured, e.g. reveal). */
  msToSolve?: number | null;
  /** The puzzle's rating, when available — used to anchor the next target. */
  puzzleRating?: number | null;
}

// --- Control-law constants (exported so the spec + handoff can pin them) -----

/** The success rate we steer toward — the centre of the productive band. */
export const TARGET_SUCCESS = 0.8;
/** Low edge of the productive struggle band. */
export const PRODUCTIVE_BAND_LOW = 0.75;
/** High edge of the productive struggle band. */
export const PRODUCTIVE_BAND_HIGH = 0.85;
/** Proportional gain (Elo per unit success-error) in steady state. */
export const GAIN = 800;
/** Larger gain while calibrating a new user — react faster to scarce data. */
export const CALIBRATION_GAIN = 1400;
/** Max Elo any single adjustment may move (damping). */
export const MAX_STEP = 60;
/** Max Elo any single adjustment may move while calibrating (wider swings). */
export const CALIBRATION_MAX_STEP = 140;
/** Half-width of the bound around the user's anchor rating. */
export const BAND = 300;
/** Extra upward nudge for a clean fast-solve streak. */
export const SPEED_BONUS = 25;
/** A solve faster than this (ms) counts as "fast" for the speed bonus. */
export const FAST_SOLVE_MS = 8000;
/** A solve streak of this length (all fast) triggers the speed bonus. */
export const FAST_STREAK_LEN = 3;
/** Downward nudge per consecutive fail at the tail of the window. */
export const FAIL_NUDGE = 20;
/** Consecutive fails before the fail nudge engages. */
export const FAIL_STREAK_LEN = 2;

/** Attempts below which the user is still being calibrated (first-run window). */
export const CALIBRATION_ATTEMPTS = 8;
/** Steady-state first-tier half-window (matches the S03 serving ladder ±150). */
export const STEADY_BAND_HALF = 150;
/** Wider half-window used during the calibration phase. */
export const CALIBRATION_BAND_HALF = 350;

/** How many recent attempts the success-rate term averages over. */
export const SUCCESS_WINDOW = 10;

/** Avoid serving the same theme more than this many times in a row. */
export const MAX_SAME_THEME_RUN = 2;

/** Clamp helper. */
function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/** True while the user has too few attempts to trust a steady-state estimate. */
export function isCalibrating(attemptCount: number): boolean {
  return attemptCount < CALIBRATION_ATTEMPTS;
}

/**
 * Half-width of the rating window to search around the target. Widened during
 * the calibration window so a new user sees a spread of difficulties and we find
 * their level fast; the steady-state value matches the S03 ladder's first tier
 * so post-calibration behavior is unchanged.
 */
export function calibrationBand(attemptCount: number): number {
  return isCalibrating(attemptCount) ? CALIBRATION_BAND_HALF : STEADY_BAND_HALF;
}

/** Length of the run of solved+fast results at the END (most recent) of the window. */
function trailingFastSolveStreak(recent: RecentResult[]): number {
  let streak = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const r = recent[i];
    if (r.solved && typeof r.msToSolve === 'number' && r.msToSolve <= FAST_SOLVE_MS) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Length of the run of fails at the END (most recent) of the window. */
function trailingFailStreak(recent: RecentResult[]): number {
  let streak = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (!recent[i].solved) streak++;
    else break;
  }
  return streak;
}

/** Observed success rate over the most recent {@link SUCCESS_WINDOW} attempts. */
function recentSuccessRate(recent: RecentResult[]): number {
  const window = recent.slice(-SUCCESS_WINDOW);
  if (window.length === 0) return TARGET_SUCCESS; // no data → no error → no move
  const solved = window.reduce((n, r) => n + (r.solved ? 1 : 0), 0);
  return solved / window.length;
}

/**
 * The adjusted target rating given recent results and the current target.
 *
 * NO-HISTORY GUARANTEE: with an empty `recent` array this returns
 * `Math.round(currentTarget)` unchanged — so a caller with no history gets the
 * exact same target the S03 ladder would have used. See the control-law block
 * at the top of the file for the full derivation.
 *
 * @param recent        recent attempts, OLDEST-first (most recent last)
 * @param currentTarget the rating the serving ladder would otherwise centre on
 * @param anchor        the user's own puzzle rating; the result is bounded to
 *                      `anchor ± BAND`. Defaults to `currentTarget`.
 */
export function nextDifficulty(
  recent: RecentResult[],
  currentTarget: number,
  anchor: number = currentTarget,
): number {
  if (recent.length === 0) return Math.round(currentTarget);

  const calibrating = isCalibrating(recent.length);
  const gain = calibrating ? CALIBRATION_GAIN : GAIN;
  const maxStep = calibrating ? CALIBRATION_MAX_STEP : MAX_STEP;

  // Proportional term: steer success toward the 80% setpoint.
  const successError = recentSuccessRate(recent) - TARGET_SUCCESS;
  let step = successError * gain;

  // Speed term: a clean fast-solve streak is the clearest "too easy" signal.
  if (trailingFastSolveStreak(recent) >= FAST_STREAK_LEN) {
    step += SPEED_BONUS;
  }

  // Fail term: ease off promptly when the user is stuck, before the average
  // success rate has time to drag down.
  const failStreak = trailingFailStreak(recent);
  if (failStreak >= FAIL_STREAK_LEN) {
    step -= FAIL_NUDGE * (failStreak - FAIL_STREAK_LEN + 1);
  }

  // Damp the per-call movement, then bound the absolute target to anchor ± BAND.
  step = clamp(step, -maxStep, maxStep);
  const next = clamp(currentTarget + step, anchor - BAND, anchor + BAND);
  return Math.round(next);
}

/**
 * Pick the next theme to bias toward when the caller did NOT request a specific
 * theme. Returns a weak theme to reinforce, or `null` to leave the stream
 * unfiltered.
 *
 * Policy — SPACING beats BLOCKING: we bias toward the user's weakest themes
 * (the ones to improve) but never serve the same theme more than
 * {@link MAX_SAME_THEME_RUN} times in a row. Interleaving weak material with
 * fresh material retains better than hammering one theme until it's "fixed".
 *
 * NO-HISTORY GUARANTEE: with no weak themes this returns `null` (unfiltered),
 * the same as the S03 caller passing no theme.
 *
 * @param weakThemes   candidate themes to bias toward, WEAKEST-first
 * @param recentThemes the themes of the most recently served puzzles,
 *                     OLDEST-first (most recent last)
 */
export function interleaveThemes(
  weakThemes: string[],
  recentThemes: string[],
): string | null {
  if (weakThemes.length === 0) return null;

  // If the tail of the recent stream is already a run of one theme at the cap,
  // force a DIFFERENT theme (or unfiltered) — spacing.
  const lastTheme = recentThemes[recentThemes.length - 1];
  let run = 0;
  for (let i = recentThemes.length - 1; i >= 0; i--) {
    if (recentThemes[i] === lastTheme) run++;
    else break;
  }
  const blocked = run >= MAX_SAME_THEME_RUN ? lastTheme : undefined;

  for (const theme of weakThemes) {
    if (theme !== blocked) return theme;
  }

  // Every candidate is the blocked theme — break the run by going unfiltered.
  return null;
}

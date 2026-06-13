import {
  BAND,
  CALIBRATION_ATTEMPTS,
  CALIBRATION_BAND_HALF,
  MAX_STEP,
  STEADY_BAND_HALF,
  calibrationBand,
  interleaveThemes,
  isCalibrating,
  nextDifficulty,
  type RecentResult,
} from '../../src/puzzles/adaptive-selector';

/** Build a window of N fast solves (all solved, all under the fast threshold). */
function fastSolves(n: number, puzzleRating = 1500): RecentResult[] {
  return Array.from({ length: n }, () => ({
    solved: true,
    msToSolve: 4000,
    puzzleRating,
  }));
}

/** Build a window of N fails. */
function fails(n: number, puzzleRating = 1500): RecentResult[] {
  return Array.from({ length: n }, () => ({
    solved: false,
    msToSolve: null,
    puzzleRating,
  }));
}

/**
 * A window at exactly the 80% setpoint that does NOT end in a fail run (so the
 * trailing-fail nudge stays disengaged): two fails up front, then eight solves.
 * The eight trailing solves are SLOW (over the fast threshold) so the speed
 * bonus also stays off — leaving only the proportional term, which is ~0 here.
 */
function atTargetWindow(): RecentResult[] {
  const slowSolves = Array.from({ length: 8 }, () => ({
    solved: true,
    msToSolve: 20000,
    puzzleRating: 1500,
  }));
  return fails(2).concat(slowSolves);
}

describe('adaptive-selector — nextDifficulty (control law)', () => {
  it('EMPTY history is a no-op: returns the current target unchanged', () => {
    // The backward-compatibility guarantee — S03 selection is identical.
    expect(nextDifficulty([], 1500)).toBe(1500);
    expect(nextDifficulty([], 1834)).toBe(1834);
    // Rounds a fractional target but never moves it.
    expect(nextDifficulty([], 1500.4)).toBe(1500);
  });

  it('climbs after a streak of fast solves (steady state)', () => {
    // 12 attempts => past the calibration window; all fast solves => well above
    // the 80% setpoint, so difficulty must increase.
    const recent = fastSolves(12);
    const next = nextDifficulty(recent, 1500, 1500);
    expect(next).toBeGreaterThan(1500);
  });

  it('eases after consecutive fails (steady state)', () => {
    // 12 attempts, all fails => far below setpoint => difficulty must drop.
    const recent = fails(12);
    const next = nextDifficulty(recent, 1500, 1500);
    expect(next).toBeLessThan(1500);
  });

  it('is DAMPED: a single call never moves more than MAX_STEP in steady state', () => {
    const up = nextDifficulty(fastSolves(12), 1500, 1500);
    const down = nextDifficulty(fails(12), 1500, 1500);
    expect(up - 1500).toBeLessThanOrEqual(MAX_STEP);
    expect(1500 - down).toBeLessThanOrEqual(MAX_STEP);
  });

  it('is BOUNDED: the result never leaves anchor ± BAND', () => {
    // Drive it hard upward many times; even compounding can never exceed the band.
    let target = 1500;
    const anchor = 1500;
    for (let i = 0; i < 50; i++) {
      target = nextDifficulty(fastSolves(12), target, anchor);
    }
    expect(target).toBeLessThanOrEqual(anchor + BAND);

    // ...and hard downward.
    target = 1500;
    for (let i = 0; i < 50; i++) {
      target = nextDifficulty(fails(12), target, anchor);
    }
    expect(target).toBeGreaterThanOrEqual(anchor - BAND);
  });

  it('holds steady when success sits inside the productive band', () => {
    // 8/10 solved == the 80% setpoint, no trailing fast-solve streak past the
    // last two fails => proportional term ~0 => target essentially unchanged.
    const recent = atTargetWindow();
    const next = nextDifficulty(recent, 1500, 1500);
    expect(Math.abs(next - 1500)).toBeLessThanOrEqual(5);
  });

  it('eases harder on a trailing fail streak than the average alone would', () => {
    // SAME overall success (8/10 == the 80% setpoint, so the proportional term
    // is ~0 and doesn't hit the damping clamp). The only difference is WHERE the
    // two fails sit: ending in the fail run engages the trailing-fail nudge, so
    // that window eases more even though the average is identical.
    const slow = (n: number): RecentResult[] =>
      Array.from({ length: n }, () => ({ solved: true, msToSolve: 20000, puzzleRating: 1500 }));
    const failsLast = slow(8).concat(fails(2)); // ends in a 2-fail run
    const failsFirst = fails(2).concat(slow(8)); // fails up front, ends on solves
    const a = nextDifficulty(failsLast, 1500, 1500);
    const b = nextDifficulty(failsFirst, 1500, 1500);
    expect(a).toBeLessThan(b);
  });
});

describe('adaptive-selector — calibration (first run)', () => {
  it('isCalibrating is true below the window, false at/after it', () => {
    expect(isCalibrating(0)).toBe(true);
    expect(isCalibrating(CALIBRATION_ATTEMPTS - 1)).toBe(true);
    expect(isCalibrating(CALIBRATION_ATTEMPTS)).toBe(false);
    expect(isCalibrating(CALIBRATION_ATTEMPTS + 5)).toBe(false);
  });

  it('widens the search band for a new user, narrows it once calibrated', () => {
    expect(calibrationBand(0)).toBe(CALIBRATION_BAND_HALF);
    expect(calibrationBand(CALIBRATION_ATTEMPTS - 1)).toBe(CALIBRATION_BAND_HALF);
    expect(calibrationBand(CALIBRATION_ATTEMPTS)).toBe(STEADY_BAND_HALF);
    // Wider while calibrating than the steady first tier.
    expect(CALIBRATION_BAND_HALF).toBeGreaterThan(STEADY_BAND_HALF);
  });

  it('moves the estimate further per call while calibrating (larger swings)', () => {
    // A few solves during calibration should move difficulty more than the same
    // few solves would in steady state (proves the bigger gain/step).
    const fewSolves = fastSolves(3); // length 3 => calibrating
    const calibratingMove = nextDifficulty(fewSolves, 1500, 1500) - 1500;
    expect(calibratingMove).toBeGreaterThan(MAX_STEP);
  });
});

describe('adaptive-selector — interleaveThemes (spacing over blocking)', () => {
  it('returns null when there are no weak themes (unfiltered, no-op)', () => {
    expect(interleaveThemes([], [])).toBeNull();
    expect(interleaveThemes([], ['fork', 'pin'])).toBeNull();
  });

  it('biases toward the weakest theme when nothing is running', () => {
    expect(interleaveThemes(['fork', 'pin'], [])).toBe('fork');
    expect(interleaveThemes(['fork', 'pin'], ['skewer'])).toBe('fork');
  });

  it('avoids a third in a row of the same theme (spacing beats blocking)', () => {
    // fork served twice consecutively => the next must differ.
    const next = interleaveThemes(['fork', 'pin'], ['fork', 'fork']);
    expect(next).toBe('pin');
    expect(next).not.toBe('fork');
  });

  it('never produces a 3-in-a-row run across repeated calls', () => {
    const weak = ['fork', 'pin'];
    const served: string[] = [];
    for (let i = 0; i < 12; i++) {
      const t = interleaveThemes(weak, served);
      // null => unfiltered; record a sentinel so runs still break.
      served.push(t ?? '_mixed');
    }
    // Assert no theme appears 3+ times consecutively.
    let maxRun = 1;
    let run = 1;
    for (let i = 1; i < served.length; i++) {
      if (served[i] === served[i - 1] && served[i] !== '_mixed') {
        run++;
        maxRun = Math.max(maxRun, run);
      } else {
        run = 1;
      }
    }
    expect(maxRun).toBeLessThanOrEqual(2);
  });

  it('goes unfiltered when the only weak theme is the blocked one', () => {
    // fork is the lone weak theme but already ran to the cap => break the run.
    expect(interleaveThemes(['fork'], ['fork', 'fork'])).toBeNull();
  });
});

import {
  DEFAULT_EASE,
  EASY_BONUS,
  FIRST_INTERVAL_DAYS,
  MIN_EASE,
  MS_PER_DAY,
  SECOND_INTERVAL_DAYS,
  offsetDays,
  schedule,
  toCardState,
  type CardState,
} from '../../src/puzzles/spaced-repetition';

/** A pristine, never-reviewed card. */
function freshCard(over: Partial<CardState> = {}): CardState {
  return { intervalDays: 0, easeFactor: DEFAULT_EASE, reps: 0, lapses: 0, ...over };
}

describe('spaced-repetition schedule()', () => {
  describe("'good' — the success ladder", () => {
    it('first success → 1 day, reps 1, ease held', () => {
      const r = schedule(freshCard(), 'good');
      expect(r.intervalDays).toBe(FIRST_INTERVAL_DAYS); // 1
      expect(r.reps).toBe(1);
      expect(r.lapses).toBe(0);
      expect(r.easeFactor).toBe(DEFAULT_EASE); // good holds ease flat
      expect(r.nextDueOffsetDays).toBe(r.intervalDays);
    });

    it('second success → 6 days, reps 2', () => {
      const after1 = schedule(freshCard(), 'good');
      const after2 = schedule(after1, 'good');
      expect(after2.intervalDays).toBe(SECOND_INTERVAL_DAYS); // 6
      expect(after2.reps).toBe(2);
    });

    it('third success → previous × ease (6 × 2.5 = 15)', () => {
      const after1 = schedule(freshCard(), 'good');
      const after2 = schedule(after1, 'good');
      const after3 = schedule(after2, 'good');
      // 6 * 2.5 = 15
      expect(after3.intervalDays).toBe(15);
      expect(after3.reps).toBe(3);
      expect(after3.easeFactor).toBe(DEFAULT_EASE);
    });

    it('grows monotonically across a multi-step good streak', () => {
      let card: CardState = freshCard();
      const intervals: number[] = [];
      for (let i = 0; i < 4; i++) {
        const next = schedule(card, 'good');
        intervals.push(next.intervalDays);
        card = next;
      }
      // 1, 6, 15, 38 (15 * 2.5 = 37.5 → 38)
      expect(intervals).toEqual([1, 6, 15, 38]);
      // strictly increasing
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
      }
    });
  });

  describe("'again' — lapse resets and drops ease (with a floor)", () => {
    it('resets reps→0, increments lapses, interval→1, ease −0.2', () => {
      // A matured card (3 reps, interval 15, ease 2.5).
      const mature: CardState = { intervalDays: 15, easeFactor: 2.5, reps: 3, lapses: 0 };
      const r = schedule(mature, 'again');
      expect(r.reps).toBe(0);
      expect(r.lapses).toBe(1);
      expect(r.intervalDays).toBe(1);
      expect(r.easeFactor).toBe(2.3); // 2.5 - 0.2
      expect(r.nextDueOffsetDays).toBe(1);
    });

    it('never drops ease below the floor (1.3)', () => {
      // Already at the floor; another lapse must not push it lower.
      const atFloor: CardState = { intervalDays: 1, easeFactor: MIN_EASE, reps: 0, lapses: 5 };
      const r = schedule(atFloor, 'again');
      expect(r.easeFactor).toBe(MIN_EASE);
      expect(r.lapses).toBe(6);
    });

    it('clamps at the floor when a penalty would undershoot it', () => {
      const nearFloor: CardState = { intervalDays: 2, easeFactor: 1.4, reps: 1, lapses: 2 };
      const r = schedule(nearFloor, 'again');
      // 1.4 - 0.2 = 1.2 → clamped to 1.3
      expect(r.easeFactor).toBe(MIN_EASE);
    });
  });

  describe("'easy' — bigger interval bump + ease increase", () => {
    it('raises ease by the easy bonus on a success', () => {
      const r = schedule(freshCard(), 'easy');
      expect(r.easeFactor).toBe(2.65); // 2.5 + 0.15
      expect(r.reps).toBe(1);
    });

    it('applies the easy interval bonus over a plain good on a mature card', () => {
      const mature: CardState = { intervalDays: 15, easeFactor: 2.5, reps: 3, lapses: 0 };
      const good = schedule(mature, 'good');
      const easy = schedule(mature, 'easy');
      // easy ease = 2.65; base = round(15*2.65)=40; *1.3 bonus = 52
      expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
      expect(easy.intervalDays).toBe(Math.round(Math.round(15 * 2.65) * EASY_BONUS));
    });
  });

  describe('toCardState()', () => {
    it('returns SM-2 defaults for null (new card)', () => {
      expect(toCardState(null)).toEqual({
        intervalDays: 0,
        easeFactor: DEFAULT_EASE,
        reps: 0,
        lapses: 0,
      });
    });

    it('maps a stored row verbatim', () => {
      const row = { intervalDays: 6, easeFactor: 2.3, reps: 2, lapses: 1 };
      expect(toCardState(row)).toEqual(row);
    });
  });

  describe('offsetDays()', () => {
    it('returns a Date approximately N days from now', () => {
      const before = Date.now();
      const d = offsetDays(1);
      const after = Date.now();
      expect(d.getTime()).toBeGreaterThanOrEqual(before + MS_PER_DAY - 100);
      expect(d.getTime()).toBeLessThanOrEqual(after + MS_PER_DAY + 100);
    });

    it('offsetDays(0) is approximately now', () => {
      const now = Date.now();
      const d = offsetDays(0);
      expect(Math.abs(d.getTime() - now)).toBeLessThan(100);
    });
  });

  describe('purity / determinism', () => {
    it('does not mutate the input card', () => {
      const input = freshCard({ intervalDays: 6, reps: 2 });
      const snapshot = { ...input };
      schedule(input, 'good');
      expect(input).toEqual(snapshot);
    });

    it('is deterministic — identical inputs yield identical outputs', () => {
      const card: CardState = { intervalDays: 6, easeFactor: 2.5, reps: 2, lapses: 0 };
      const a = schedule(card, 'good');
      const b = schedule(card, 'good');
      expect(a).toEqual(b);
    });

    it('reproduces a fixed solve/fail/solve sequence exactly', () => {
      let card: CardState = freshCard();
      card = schedule(card, 'good'); // 1d, reps 1
      card = schedule(card, 'good'); // 6d, reps 2
      card = schedule(card, 'again'); // lapse: 1d, reps 0, lapses 1, ease 2.3
      expect(card).toMatchObject({ intervalDays: 1, reps: 0, lapses: 1, easeFactor: 2.3 });
      card = schedule(card, 'good'); // 1d, reps 1 (ladder restarts)
      expect(card.intervalDays).toBe(1);
      expect(card.reps).toBe(1);
    });
  });
});

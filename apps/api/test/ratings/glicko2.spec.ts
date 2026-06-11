import {
  DEFAULT_RATING,
  updateRating,
  type GlickoRating,
} from '../../src/ratings/glicko2';

describe('glicko2', () => {
  it('reproduces the worked example from the Glicko-2 paper', () => {
    // Glickman's example: 1500/200/0.06 plays three opponents (win, loss, loss).
    const player: GlickoRating = { rating: 1500, ratingDeviation: 200, volatility: 0.06 };
    const result = updateRating(player, [
      { opponent: { rating: 1400, ratingDeviation: 30, volatility: 0.06 }, score: 1 },
      { opponent: { rating: 1550, ratingDeviation: 100, volatility: 0.06 }, score: 0 },
      { opponent: { rating: 1700, ratingDeviation: 300, volatility: 0.06 }, score: 0 },
    ]);
    expect(result.rating).toBeCloseTo(1464.06, 1);
    expect(result.ratingDeviation).toBeCloseTo(151.52, 1);
    expect(result.volatility).toBeCloseTo(0.05999, 4);
  });

  it('a win gains rating, a loss loses, symmetric for equal players', () => {
    const a = { ...DEFAULT_RATING };
    const b = { ...DEFAULT_RATING };
    const winner = updateRating(a, [{ opponent: b, score: 1 }]);
    const loser = updateRating(b, [{ opponent: a, score: 0 }]);
    expect(winner.rating).toBeGreaterThan(1500);
    expect(loser.rating).toBeLessThan(1500);
    expect(winner.rating - 1500).toBeCloseTo(1500 - loser.rating, 6);
  });

  it('a draw between equal players changes nothing but the deviation', () => {
    const result = updateRating(DEFAULT_RATING, [
      { opponent: DEFAULT_RATING, score: 0.5 },
    ]);
    expect(result.rating).toBeCloseTo(1500, 6);
    expect(result.ratingDeviation).toBeLessThan(350);
  });

  it('an upset win against a stronger player gains more', () => {
    const me = { rating: 1500, ratingDeviation: 100, volatility: 0.06 };
    const peer = { rating: 1500, ratingDeviation: 100, volatility: 0.06 };
    const giant = { rating: 1900, ratingDeviation: 100, volatility: 0.06 };
    const vsPeer = updateRating(me, [{ opponent: peer, score: 1 }]);
    const vsGiant = updateRating(me, [{ opponent: giant, score: 1 }]);
    expect(vsGiant.rating).toBeGreaterThan(vsPeer.rating);
  });

  it('deviation shrinks with play and grows with inactivity', () => {
    const played = updateRating(DEFAULT_RATING, [
      { opponent: DEFAULT_RATING, score: 0.5 },
    ]);
    expect(played.ratingDeviation).toBeLessThan(DEFAULT_RATING.ratingDeviation);

    const idle = updateRating(
      { rating: 1500, ratingDeviation: 50, volatility: 0.06 },
      [],
    );
    expect(idle.ratingDeviation).toBeGreaterThan(50);
    expect(idle.rating).toBe(1500);
  });
});

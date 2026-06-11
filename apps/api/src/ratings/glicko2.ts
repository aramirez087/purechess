/**
 * Glicko-2 rating system (Glickman, http://www.glicko.net/glicko/glicko2.pdf).
 * Pure functions on the public 1500-scale; conversion to/from the internal
 * mu/phi scale is encapsulated here. Each completed game is treated as its
 * own rating period (the standard approximation for continuous online play).
 */

const SCALE = 173.7178;
const BASE_RATING = 1500;
/** System constant: constrains volatility change per period. */
const TAU = 0.5;
const CONVERGENCE_EPS = 1e-6;

export interface GlickoRating {
  rating: number;
  ratingDeviation: number;
  volatility: number;
}

export interface GlickoGame {
  opponent: GlickoRating;
  /** 1 = win, 0.5 = draw, 0 = loss, from the rated player's perspective. */
  score: 0 | 0.5 | 1;
}

export const DEFAULT_RATING: GlickoRating = {
  rating: BASE_RATING,
  ratingDeviation: 350,
  volatility: 0.06,
};

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const expectedScore = (mu: number, muJ: number, phiJ: number) =>
  1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/**
 * Updates a player's rating for one rating period containing `games`.
 * With an empty games list only the deviation grows (step 6 of the paper).
 */
export function updateRating(player: GlickoRating, games: GlickoGame[]): GlickoRating {
  const mu = (player.rating - BASE_RATING) / SCALE;
  const phi = player.ratingDeviation / SCALE;
  const sigma = player.volatility;

  if (games.length === 0) {
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return {
      rating: player.rating,
      ratingDeviation: phiStar * SCALE,
      volatility: sigma,
    };
  }

  // Step 3: estimated variance of the player's rating from game outcomes.
  let vInv = 0;
  let deltaSum = 0;
  for (const { opponent, score } of games) {
    const muJ = (opponent.rating - BASE_RATING) / SCALE;
    const phiJ = opponent.ratingDeviation / SCALE;
    const gJ = g(phiJ);
    const e = expectedScore(mu, muJ, phiJ);
    vInv += gJ * gJ * e * (1 - e);
    deltaSum += gJ * (score - e);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;

  // Step 5: new volatility via the Illinois variant of regula falsi.
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const phiV = phi * phi + v;
    return (
      (ex * (delta * delta - phiV - ex)) / (2 * (phiV + ex) * (phiV + ex)) -
      (x - a) / (TAU * TAU)
    );
  };

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k += 1;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > CONVERGENCE_EPS) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }
  const newSigma = Math.exp(A / 2);

  // Steps 6-8: new deviation and rating.
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + vInv);
  const newMu = mu + newPhi * newPhi * deltaSum;

  return {
    rating: BASE_RATING + SCALE * newMu,
    ratingDeviation: SCALE * newPhi,
    volatility: newSigma,
  };
}

/**
 * Move accuracy from win-probability loss. Pure — no engine, no React.
 *
 * Centipawn loss alone is a poor accuracy signal: a swing from +900 to +400 is
 * still winning, while +50 to -450 flips the game, yet both are 500 "cpl". And
 * forced mates (±100 pawns) make any nearby move look like a catastrophic
 * blunder. So we convert each eval to a win percentage first (a logistic of cp,
 * saturating near mate) and measure the *drop in win chance* the move caused —
 * the same model Lichess/chess.com use. Accuracy then decays exponentially in
 * that drop, so a perfect move scores ~100 and a game-flipping move approaches 0.
 */

const ACC_A = 103.1668;
const ACC_B = -0.04354;
const ACC_C = -3.1668;

// Logistic steepness (Lichess's constant): maps centipawns → win probability.
const WIN_K = 0.00368208;

/**
 * Centipawns (from the side-to-move's POV) → win percentage 0–100. Saturates
 * near 0/100 for mate-magnitude scores, so a forced mate never produces an
 * unbounded "loss" against the move before it.
 */
export function cpToWinPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-WIN_K * cp)) - 1);
}

/** Win-percentage loss (0–100, the drop in win chance) → accuracy %, 0–100. */
export function winLossToAccuracy(winLossPct: number): number {
  const raw = ACC_A * Math.exp(ACC_B * Math.max(0, winLossPct)) + ACC_C;
  return Math.max(0, Math.min(100, raw));
}

/** Tailwind text color for an accuracy %, banded best→worst. */
export function accuracyBarColor(pct: number): string {
  if (pct >= 90) return 'text-emerald-400';
  if (pct >= 75) return 'text-green-400';
  if (pct >= 60) return 'text-yellow-400';
  if (pct >= 45) return 'text-orange-400';
  return 'text-red-500';
}

/** Urgency tier for a live clock chip, derived from remaining time. */
export type ClockTier = 'normal' | 'caution' | 'critical' | 'dying' | 'out';

/**
 * normal ≥ 30s (or no live ms known), caution ≥ 10s, critical ≥ 3s,
 * dying > 0, out ≤ 0 (time stopped).
 */
export function clockTier(timeMs: number | undefined): ClockTier {
  if (timeMs == null || timeMs >= 30_000) return 'normal';
  if (timeMs <= 0) return 'out';
  if (timeMs >= 10_000) return 'caution';
  if (timeMs >= 3_000) return 'critical';
  return 'dying';
}

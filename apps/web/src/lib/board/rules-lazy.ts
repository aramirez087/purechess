/**
 * Memoized loader for the chess.js-backed rules module, so the eager board
 * chunk ships without chess.js (~18 kB gz). `loadRules()` resolves in one
 * microtask once warm; `peekRules()` is the sync accessor for code paths
 * (position-diff effects) that cannot await.
 */
import type * as Rules from './rules';

export type RulesModule = typeof Rules;

let cached: RulesModule | null = null;
let pending: Promise<RulesModule> | null = null;

export function loadRules(): Promise<RulesModule> {
  if (cached) return Promise.resolve(cached);
  pending ??= import('./rules').then((m) => {
    cached = m;
    return m;
  });
  return pending;
}

/** Null until the first `loadRules()` resolves. */
export function peekRules(): RulesModule | null {
  return cached;
}

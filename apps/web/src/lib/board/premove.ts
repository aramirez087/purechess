/**
 * Compatibility shim — the implementation moved to `rules.ts` (chess.js).
 * Eager board code reaches premove validation through `rules-lazy.ts`.
 */
export type { Premove } from './types';
export { isPremoveLegal, validatePremove } from './rules';

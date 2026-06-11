import type { Square } from '@purechess/shared';

export const MOVE_DURATION_MS = 200;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * True when move animations must be skipped entirely (instant placement, no
 * capture-hold): OS reduced motion, or the `data-no-animations` kill switch
 * that globals.css uses to disable transitions.
 */
export function animationsDisabled(): boolean {
  if (prefersReducedMotion()) return true;
  return typeof document !== 'undefined' && document.querySelector('[data-no-animations]') !== null;
}

export interface AnimationSquares {
  from: Square;
  to: Square;
  capturedAt?: Square;
  rookFrom?: Square;
  rookTo?: Square;
}

// getAnimationSquares moved to rules.ts (it enumerates legal moves, which
// needs chess.js) — this module stays pure so the eager board chunk can
// import the timing constants and kill-switch helpers without the rules
// payload. Reach it via rules-lazy.ts.

// Improve epic — puzzle trainer DTOs.
//
// Plain TypeScript interfaces, zero runtime deps (matches the rest of
// packages/shared). Runtime validation belongs in the API (NestJS). New
// fields added in later sessions MUST be optional so existing literals keep
// typechecking.
//
// Server-authoritative rule: the client reports outcomes (solved, ms) and
// NEVER sets a rating. Rating/before/after fields are server-computed and
// echoed back to the client read-only.

/** How a puzzle attempt was surfaced. Mirrors the PuzzleAttemptSource enum. */
export type PuzzleSource = 'theme' | 'daily' | 'rush' | 'review' | 'mistake';

/**
 * A single puzzle served to the client. `moves` is the solution line in UCI;
 * the first move is the opponent's setup move (lichess convention), the
 * solver plays from there. Mirrors the Puzzle model.
 */
export interface PuzzleDto {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  ratingDeviation?: number;
  popularity?: number;
  plays?: number;
  themes: string[];
  openingTags?: string[];
}

/**
 * Server response to an attempt submission. The rating fields reflect the
 * user's puzzle Glicko AFTER the server processed this attempt; delta is a
 * convenience (after - before).
 */
export interface PuzzleAttemptResultDto {
  puzzleId: string;
  solved: boolean;
  /** User puzzle rating before this attempt. */
  ratingBefore?: number;
  /** User puzzle rating after this attempt (server-computed). */
  ratingAfter?: number;
  /** ratingAfter - ratingBefore, rounded. */
  ratingDelta?: number;
  /** Set when this puzzle was (re)scheduled into the review queue. */
  nextReviewAt?: string | null;
}

/**
 * Catalog entry for a tactical theme: the stable slug plus a human label and
 * optional description for the theme picker.
 */
export interface PuzzleThemeDto {
  /** lichess theme slug, e.g. "fork", "mateIn2". */
  slug: string;
  /** Human-readable label, e.g. "Fork". */
  label: string;
  description?: string;
  /** Approximate count of puzzles carrying this theme (catalog hint). */
  puzzleCount?: number;
}

/**
 * Per-theme performance stat for a user — drives the weakest-theme surfacing
 * and the accuracy color scale (red <50 / yellow <70 / green).
 */
export interface PuzzleThemeStatDto {
  slug: string;
  label?: string;
  attempts: number;
  solved: number;
  /** solved / attempts, 0..1. Undefined when attempts === 0. */
  accuracy?: number;
  /** Average ms-to-solve over solved attempts. */
  avgMsToSolve?: number;
  /** Most recent attempt time (ISO). */
  lastAttemptedAt?: string;
}

/**
 * The user's puzzle Glicko snapshot. Mirrors the PuzzleRating model; values
 * are server-owned and read-only on the client.
 */
export interface PuzzleRatingDto {
  rating: number;
  deviation?: number;
  volatility?: number;
  /** Total recorded attempts (convenience, may be omitted). */
  attempts?: number;
  updatedAt?: string;
}

// --- Spaced-repetition review (SM-2 over the PuzzleReview table) ------------
//
// A puzzle you fail enters a review queue; solving it on schedule pushes it
// out at growing intervals; failing it resets it. Scheduling is server-owned
// (the client reports solved + ms and reads back the next due date).

/** GET /puzzles/review/due — the due-today queue plus its size. */
export interface ReviewDueDto {
  /** Due puzzles, oldest-first (most overdue first). */
  puzzles: PuzzleDto[];
  /** Total cards due now (may exceed `puzzles.length` when the queue is capped). */
  dueCount: number;
  /**
   * ISO time the next card becomes due, when nothing is due right now. Powers
   * the "all caught up — next review {date}" empty state. Null when the user
   * has no review cards at all.
   */
  nextDueAt?: string | null;
}

/** POST /puzzles/review/:id/grade — the rescheduled card after a graded review. */
export interface ReviewGradeResultDto {
  puzzleId: string;
  /** True when the card graduated out of the queue (interval crossed the threshold). */
  graduated: boolean;
  /** ISO time the card is next due. Null once it has graduated (no longer scheduled). */
  nextDueAt: string | null;
  /** The card's scheduling interval (days) after this grade. */
  intervalDays: number;
}

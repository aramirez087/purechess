// Improve epic — training hub / insights DTOs.
//
// Plain TypeScript interfaces, zero runtime deps. New fields added in later
// sessions MUST be optional. Streaks and plans are server-authoritative; the
// client renders them and reports raw activity, never the computed streak.

/** A single actionable item in the daily training plan. */
export interface TrainingPlanItemDto {
  /** Stable kind so the UI can route + icon it. */
  kind: 'theme' | 'review' | 'rush' | 'mistake' | 'opening' | 'endgame';
  /** Short imperative label, e.g. "Solve 8 fork puzzles". */
  label: string;
  /** Optional theme/opening/endgame slug this item targets. */
  targetSlug?: string;
  /** Suggested count (puzzles/reviews/drills). */
  count?: number;
  /** Rough minutes this item should take. */
  estimatedMinutes?: number;
  /** Where the item links to, e.g. "/puzzles/train?theme=fork". */
  href?: string;
  /** True once the user has satisfied this item today. */
  completed?: boolean;
}

/**
 * Today's 10-minute training plan — a small ordered list of items aimed at
 * the user's weakest area, plus the day's goal/progress.
 */
export interface TrainingPlanDto {
  /** ISO date (YYYY-MM-DD) the plan is for. */
  date: string;
  items: TrainingPlanItemDto[];
  /** Daily puzzle goal (from TrainingStreak.dailyGoalPuzzles). */
  dailyGoalPuzzles?: number;
  /** Puzzles solved today (TrainingDay.puzzlesSolved). */
  puzzlesSolvedToday?: number;
  /** Total estimated minutes for the plan. */
  estimatedMinutes?: number;
}

/** One calendar day of activity — feeds the contribution graph. */
export interface TrainingDayDto {
  /** ISO date (YYYY-MM-DD). */
  day: string;
  puzzlesSolved: number;
  reviewsDone: number;
  drillsDone: number;
}

/**
 * The user's streak snapshot. Mirrors the TrainingStreak model; all values
 * server-computed. `history` is optional so a lightweight streak read need
 * not ship the whole contribution graph.
 */
export interface TrainingStreakDto {
  currentStreak: number;
  longestStreak: number;
  /** ISO date of last training day, or null if never. */
  lastTrainedOn?: string | null;
  dailyGoalPuzzles: number;
  /** True iff the user has met today's goal. */
  goalMetToday?: boolean;
  /** Recent activity for the contribution graph. */
  history?: TrainingDayDto[];
}

/**
 * One ranked weakness in the insights engine — "what to work on". `area`
 * keys the source domain; `slug` names the specific theme/opening/endgame.
 */
export interface WeaknessDto {
  area: 'theme' | 'opening' | 'endgame' | 'time';
  /** theme/opening/endgame slug (absent for the "time" area). */
  slug?: string;
  /** Human label, e.g. "Back-rank mates". */
  label: string;
  /** 0..1 accuracy in this area (lower = weaker). */
  accuracy?: number;
  /** Sample size behind the accuracy. */
  sampleSize?: number;
  /** Estimated rating points on the table if addressed (heuristic). */
  estimatedEloUpside?: number;
}

/**
 * A cross-cutting insight surfaced on /train/insights — a ranked list of
 * weaknesses plus a single headline recommendation.
 */
export interface InsightDto {
  /** When this insight was computed (ISO). */
  generatedAt?: string;
  /** One-line "do this next" recommendation. */
  headline?: string;
  /** Ranked weaknesses, strongest signal first. */
  weaknesses: WeaknessDto[];
}

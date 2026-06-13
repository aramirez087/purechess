// Improve epic — training hub / insights DTOs.
//
// Plain TypeScript interfaces, zero runtime deps. New fields added in later
// sessions MUST be optional. Streaks and plans are server-authoritative; the
// client renders them and reports raw activity, never the computed streak.

/** A single actionable item in the daily training plan. */
export interface TrainingPlanItemDto {
  /** Stable kind so the UI can route + icon it. */
  kind: 'daily' | 'theme' | 'review' | 'rush' | 'mistake' | 'opening' | 'endgame';
  /** Short imperative label, e.g. "Solve 8 fork puzzles". */
  label: string;
  /** Optional theme/opening/endgame slug this item targets. */
  targetSlug?: string;
  /** Suggested count (puzzles/reviews/drills) — alias of {@link target}. */
  count?: number;
  /**
   * How many of this item the user should complete today (e.g. 8 puzzles, 5
   * reviews). The plan item is satisfied once `doneToday >= target`.
   */
  target?: number;
  /** How many the user has already done today (from the day's TrainingDay counts). */
  doneToday?: number;
  /** Rough minutes this item should take. */
  estimatedMinutes?: number;
  /** Where the item links to, e.g. "/puzzles/train?theme=fork". */
  href?: string;
  /** True once the user has satisfied this item today (`doneToday >= target`). */
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

/** Body for `POST /train/goal` — set the user's daily puzzle goal. */
export interface SetTrainingGoalDto {
  /** New daily puzzle goal (1..50). */
  dailyGoalPuzzles: number;
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
 * The source domain a weakness was detected in. Drives which detector produced
 * it and how the UI icons/routes it. (`game-mistake` = recurring blunder theme
 * mined from the user's own games, distinct from `theme` puzzle accuracy.)
 */
export type WeaknessKind = 'theme' | 'game-mistake' | 'opening' | 'endgame' | 'time';

/**
 * One ranked weakness in the insights engine — "what to work on". Detectors
 * (S12 `weakness-detectors.ts`) each emit one of these or `null`. `area`/`kind`
 * key the source domain; `slug` names the specific theme/opening/endgame; the
 * detector fields (`title`/`evidence`/`severity`/`actionHref`) carry the
 * plain-language card content + the deep link to the drill that fixes it.
 */
export interface WeaknessDto {
  /**
   * Source domain. Retained for back-compat with the S01 stub; `kind` is the
   * finer-grained value detectors set (it distinguishes `game-mistake` from
   * `theme`). When only `area` matters, `game-mistake` collapses to `theme`.
   */
  area: 'theme' | 'opening' | 'endgame' | 'time';
  /** Finer-grained detector kind (set by S12 detectors). */
  kind?: WeaknessKind;
  /** theme/opening/endgame slug (absent for the "time" area). */
  slug?: string;
  /** Human label, e.g. "Back-rank mates". */
  label: string;
  /** Plain-language card title, e.g. "Forks are costing you games". */
  title?: string;
  /** One-line evidence with the numbers, e.g. "38% on forks over 47 puzzles". */
  evidence?: string;
  /** Severity of this weakness, 0..1 (higher = weaker / more urgent). */
  severity?: number;
  /** Deep link to the drill that fixes it, e.g. "/puzzles/train?theme=fork". */
  actionHref?: string;
  /** 0..1 accuracy in this area (lower = weaker). */
  accuracy?: number;
  /** Sample size behind the accuracy. */
  sampleSize?: number;
  /** Estimated rating points on the table if addressed (heuristic). */
  estimatedEloUpside?: number;
}

/**
 * A cross-cutting insight surfaced on /train/insights — a ranked list of
 * weaknesses plus a single headline recommendation. `weaknesses` is ranked
 * strongest-signal-first (severity × impact); the top one is the headline.
 */
export interface InsightDto {
  /** When this insight was computed (ISO). */
  generatedAt?: string;
  /** One-line "do this next" recommendation (the top weakness's title). */
  headline?: string;
  /** Ranked weaknesses, strongest signal first. */
  weaknesses: WeaknessDto[];
}

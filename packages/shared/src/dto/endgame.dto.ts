/**
 * Endgame-drill DTOs (`@purechess/shared`). Plain TS interfaces, zero runtime
 * deps — runtime validation lives in the API layer. New fields must be OPTIONAL
 * (the API builds these literals; a required addition would break its
 * typecheck). The web and api both import these.
 *
 * A drill is a curated, must-know endgame (basic mate, K+P race, Lucena,
 * Philidor, …). The user plays their side on the board and converts (or holds)
 * against PERFECT defense — ground truth comes from the lichess tablebase
 * (server-side + cached), with Stockfish as the fallback defender once a
 * position has more than 7 men.
 */

/** EndgameCategory enum values (mirrors the frozen Prisma enum). */
export type EndgameCategoryDto =
  | 'basic_mate'
  | 'king_pawn'
  | 'rook'
  | 'minor'
  | 'queen'
  | 'other';

/** EndgameObjective enum values (mirrors the frozen Prisma enum). */
export type EndgameObjectiveDto = 'win' | 'draw';

/**
 * One curated endgame drill plus the current user's pass/fail state.
 *
 * `objective`: 'win' → the user must mate / promote and win; 'draw' → the user
 * must HOLD the draw against best play. `attempted`/`solved` reflect the user's
 * own history (both undefined / false for a signed-out viewer).
 */
export interface EndgameDrillDto {
  id: string;
  slug: string;
  name: string;
  category: EndgameCategoryDto;
  /** Start position the user plays from. */
  fen: string;
  objective: EndgameObjectiveDto;
  /** Optional target distance-to-mate (plies) for a 'win' drill. */
  targetDtm?: number;
  /** Relative difficulty (0 = easiest); used only for ordering within a family. */
  difficulty: number;
  /** Whether the current user has ever attempted this drill. */
  attempted?: boolean;
  /** Whether the current user has ever PASSED this drill. */
  solved?: boolean;
}

/**
 * Tablebase probe of one position (proxied through the API so the tablebase URL
 * stays server-side and the immutable result is cached hard).
 *
 * `category` is from the SIDE-TO-MOVE's point of view: 'win' → side to move is
 * winning, 'loss' → side to move is lost, 'draw' → drawn, 'unknown' → not in the
 * tablebase (more than 7 men, or the probe failed) so the client falls back to
 * Stockfish. `bestMove` is the tablebase's top-ranked move (UCI) when known.
 */
export interface EndgameProbeDto {
  category: 'win' | 'draw' | 'loss' | 'unknown';
  /** Best move for the side to move, UCI (e.g. "e2e4"), when in tablebase. */
  bestMove?: string;
  /** Distance to mate in plies (signed; from side-to-move POV) when known. */
  dtm?: number;
}

/** POST /endgames/:slug/attempt body — the outcome the client reports. */
export interface EndgameAttemptInputDto {
  /** True when the user reached the objective (mate for win / held the draw). */
  succeeded: boolean;
  /** Number of the user's own moves played before the attempt resolved. */
  movesPlayed: number;
}

/** POST /endgames/:slug/attempt result — the recorded attempt. */
export interface EndgameAttemptResultDto {
  drillId: string;
  slug: string;
  succeeded: boolean;
  movesPlayed: number;
  /** ISO timestamp the attempt was recorded. */
  recordedAt: string;
}

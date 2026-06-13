// Improve epic — Puzzle Rush (timed board-vision drill) DTOs.
//
// Plain TypeScript interfaces, zero runtime deps (matches the rest of
// packages/shared). Runtime validation belongs in the API (NestJS). New
// fields added later MUST be optional so existing literals keep typechecking.
//
// Server-authoritative rule: the client reports the run outcome (score, ms)
// and NEVER sets its own personal best — the PB is server-owned (stored in
// Redis, since the schema is frozen with no PuzzleRun table) and echoed back.

import type { PuzzleDto } from './puzzle.dto';

/**
 * Puzzle Rush mode:
 *  - `3min`: a 3-minute clock; the run ends when the clock hits zero.
 *  - `5strikes`: no clock; the run ends at 5 wrong answers.
 * Defaults to `3min`.
 */
export type RushMode = '3min' | '5strikes';

/** Request body to begin a run. */
export interface RushStartRequestDto {
  /** Defaults to '3min' server-side when omitted. */
  mode?: RushMode;
}

/** Server response to starting a run: a run id + the assembled puzzle set. */
export interface RushStartResponseDto {
  /** Opaque id for this run (also keys the server-cached set). */
  runId: string;
  /** The escalating-difficulty puzzle set, in play order. */
  puzzles: PuzzleDto[];
  /** Echo of the resolved mode. */
  mode: RushMode;
}

/** Request body to record a finished run. */
export interface RushFinishRequestDto {
  mode?: RushMode;
  /** Correct solves in the run. */
  score: number;
  /** Wall-clock duration of the run, in ms. */
  durationMs?: number;
}

/** Server response after recording a run: the personal best + whether this set it. */
export interface RushFinishResponseDto {
  /** The user's best score for this mode (server-owned). */
  best: number;
  /** True when this run set a new personal best. */
  isPB: boolean;
  /** Echo of the resolved mode. */
  mode: RushMode;
}

/** A user's personal best per rush mode (for the pre-run screen). */
export interface RushPersonalBestsDto {
  '3min': number;
  '5strikes': number;
}

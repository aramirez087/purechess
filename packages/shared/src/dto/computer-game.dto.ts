export interface CreateComputerGameDto {
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  color: 'white' | 'black' | 'random';
  timeControlSeconds: number;
  incrementSeconds?: number;
  /** Target UCI_Elo for engine strength mode (Session 03). */
  eloTarget?: number;
  /** Engine movetime per move, in ms. */
  thinkTimeMs?: number;
  /** ± centipawn window for human-like (blundering) play. */
  styleBlunderCp?: number;
}

export interface ComputerMoveDto {
  /** UCI move, or "resign". */
  move: string;
}

/**
 * Serialized (number) clock — mirrors engine/clock.ts serializeClock().
 * Never bigint (not JSON-safe).
 */
export interface ComputerClockDto {
  whiteMs: number;
  blackMs: number;
  /** Epoch ms of last tick. */
  lastTickAt: number;
  incrementMs?: number;
}

export interface ComputerGameStateDto {
  gameId: string;
  fen: string;
  pgn: string;
  /** 'active' | 'completed' | 'aborted'. */
  status: string;
  computerColor: 'white' | 'black';
  computerLevel: number;
  lastComputerMove: string | null;
  result: string | null;
  resultReason: string | null;
  // --- NEW, all OPTIONAL so the existing toStateDto literal still typechecks.
  //     Session 02 populates these when it rewrites the service. ---
  /** Serialized per-side clock. */
  clock?: ComputerClockDto | null;
  /** A draw offer is currently pending. */
  drawOffered?: boolean;
  /** Side that offered the pending draw (matches drawOfferedBy column). */
  drawOfferedBy?: 'white' | 'black' | null;
  /** True iff zero player moves made — game may still be aborted. */
  abortable?: boolean;
  /** Custom UCI_Elo target (ELO mode); overrides level profile when set. */
  eloTarget?: number;
  /** ± centipawn blunder window for human-like play. */
  styleBlunderCp?: number;
  /** Engine movetime per move, in ms. */
  thinkTimeMs?: number;
}

/** Client-side engine strength knobs persisted in `engineState` JSON. */
export interface ComputerEngineConfig {
  eloTarget?: number;
  styleBlunderCp?: number;
  thinkTimeMs?: number;
}

// ---- Request DTOs (plain interfaces, matching existing shared style) ----

export interface TakebackDto {
  /** 1 = undo human move; 2 = undo human move + bot reply. */
  plies: 1 | 2;
}

export interface RewindToPlyDto {
  /** Truncate game to this ply (>= 0). */
  ply: number;
}

export interface AbortDto {
  /** Optional reason; keeps the interface non-empty (lint). */
  reason?: string;
}

export interface DrawActionDto {
  action: 'offer' | 'accept' | 'decline' | 'claim';
}

export interface RematchDto {
  /** Reuse same settings; optionally swap sides. */
  swapColors?: boolean;
}

export interface CreateFromFenDto extends CreateComputerGameDto {
  /** Starting position; strength/time settings inherited. */
  fen: string;
}

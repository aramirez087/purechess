export interface EngineEval {
  /** Centipawn score from side-to-move POV; absent if mate. */
  cp?: number;
  /** Moves-to-mate; absent if cp. */
  mate?: number;
  depth: number;
  /** Best move, UCI. */
  bestmove: string;
  /** Principal variation, UCI moves. */
  pv: string[];
}

export interface EngineAnalysisOptions {
  movetimeMs?: number;
  /** Lines to report (1-3). */
  multiPv?: number;
  /** UCI_LimitStrength + UCI_Elo target. */
  eloTarget?: number;
  /** UCI Skill Level (0-20). */
  skill?: number;
  /** Style knob — ± centipawn blunder window. */
  blunderCp?: number;
  /** Seed for reproducible move selection. */
  deterministicSeed?: number;
}

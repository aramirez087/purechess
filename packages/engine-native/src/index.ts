// Typed re-exports for @purechess/engine-native.
// Runtime implementation is provided by index.js (CJS shim → purechess-engine-native binary).
// Function signatures are declared here so TypeScript consumers get full type safety
// without needing the native binary present at typecheck time.

export * from './types.js';

import type {
  MoveOutcomeJs,
  LegalMoveJs,
  GameStateJs,
  ClockSnapshotJs,
  DetectOutcomeJs,
  PgnHeadersJs,
  ParsedFenJs,
} from './types.js';

export declare function validateMove(fen: string, uci: string): MoveOutcomeJs;
export declare function legalMoves(fen: string): LegalMoveJs[];
export declare function applyMoves(
  fen: string,
  ucis: string[],
  clock?: ClockSnapshotJs | null,
): GameStateJs;
export declare function detectResult(fen: string): DetectOutcomeJs | null;
export declare function toPgn(fen: string, ucis: string[], headers: PgnHeadersJs): string;
export declare function parseFen(fen: string): ParsedFenJs;

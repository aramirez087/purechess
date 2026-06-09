// TypeScript interfaces mirroring the napi-rs generated shapes.
// Enum fields are string literals matching the serde discriminants in types.rs.

export type GameResult = 'white_wins' | 'black_wins' | 'draw';
export type GameResultReason =
  | 'checkmate'
  | 'resignation'
  | 'timeout'
  | 'stalemate'
  | 'insufficient_material'
  | 'threefold_repetition'
  | 'fifty_move_rule'
  | 'draw_agreement'
  | 'abandonment';
export type Color = 'w' | 'b';
export type PieceKind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface MoveOutcomeJs {
  newFen: string;
  san: string;
  isCapture: boolean;
  capturedPiece?: PieceKind | null;
  isCheck: boolean;
  isMate: boolean;
}

export interface LegalMoveJs {
  uci: string;
  san: string;
}

export interface PlyJs {
  ply: number;
  san: string;
  uci: string;
  fenAfter: string;
  by: Color;
}

export interface ClockSnapshotJs {
  whiteMs: number;
  blackMs: number;
  lastTickAt: number;
  incrementMs: number;
}

export interface GameStateJs {
  fen: string;
  result?: GameResult | null;
  reason?: GameResultReason | null;
  moves: PlyJs[];
  clock?: ClockSnapshotJs | null;
}

export interface DetectOutcomeJs {
  result: GameResult;
  reason: GameResultReason;
}

export interface PgnHeadersJs {
  event?: string | null;
  site?: string | null;
  date?: string | null;
  white: string;
  black: string;
  result: string;
  timeControl?: string | null;
  whiteElo?: number | null;
  blackElo?: number | null;
  eco?: string | null;
}

export interface ParsedFenJs {
  piecePlacement: string;
  activeColor: Color;
  castling: string;
  enPassant?: string | null;
  halfmoveClock: number;
  fullmoveNumber: number;
}

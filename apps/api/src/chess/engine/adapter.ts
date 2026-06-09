import { GameResult, GameTermination } from '@purechess/shared';

export interface MoveOutcome {
  newFen: string;
  san: string;
  uci: string;
  isCapture: boolean;
  capturedPiece?: string | null;
  isCheck: boolean;
  isMate: boolean;
}

export interface LegalMove {
  uci: string;
  san: string;
}

export interface AdapterMove {
  ply: number;
  san: string;
  uci: string;
  fenAfter: string;
  by: 'w' | 'b';
}

export interface AdapterGameState {
  fen: string;
  result: GameResult | null;
  reason: GameTermination | null;
  moves: AdapterMove[];
}

export interface AdapterClock {
  whiteMs: number;
  blackMs: number;
  lastTickAt: number;
  incrementMs: number;
}

export interface AdapterPgnHeaders {
  event?: string;
  site?: string;
  date?: string;
  white: string;
  black: string;
  result: string;
  timeControl?: string;
  whiteElo?: number;
  blackElo?: number;
  eco?: string;
}

export interface AdapterParsedFen {
  piecePlacement: string;
  activeColor: 'w' | 'b';
  castling: string;
  enPassant?: string | null;
  halfmoveClock: number;
  fullmoveNumber: number;
}

export type ResultPayload = { result: GameResult; reason: GameTermination };

export type AdapterName = 'native' | 'ts' | 'shadow-ts';

export interface EngineAdapter {
  validateMove(fen: string, uci: string): Promise<MoveOutcome>;
  legalMoves(fen: string): Promise<LegalMove[]>;
  applyMoves(fen: string, ucis: string[], clock?: AdapterClock): Promise<AdapterGameState>;
  detectResult(fen: string): Promise<ResultPayload | null>;
  toPgn(fen: string, ucis: string[], headers: AdapterPgnHeaders): Promise<string>;
  parseFen(fen: string): Promise<AdapterParsedFen>;
  name(): AdapterName;
}

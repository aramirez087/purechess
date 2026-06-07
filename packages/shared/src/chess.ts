import type { GameResult, GameTermination } from './game-result.js';

export type Color = 'w' | 'b';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Square =
  | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7' | 'a8'
  | 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b7' | 'b8'
  | 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7' | 'c8'
  | 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'd7' | 'd8'
  | 'e1' | 'e2' | 'e3' | 'e4' | 'e5' | 'e6' | 'e7' | 'e8'
  | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8'
  | 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6' | 'g7' | 'g8'
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'h7' | 'h8';

export interface Move {
  from: Square;
  to: Square;
  promotion?: PieceType;
  san?: string;
  lan?: string;
}

export type GameStatus = 'pending' | 'active' | 'completed' | 'aborted' | 'invite_pending';

export interface ClockState {
  whiteMs: number;
  blackMs: number;
  lastUpdatedAt: number;
}

export interface GameState {
  id: string;
  fen: string;
  pgn: string;
  turn: Color;
  status: GameStatus;
  moves: Move[];
  clocks: ClockState;
  result?: GameResult;
  termination?: GameTermination;
}

export type GameResultReason = GameTermination;

export interface EngineMove {
  ply: number;
  san: string;
  uci: string;
  fenAfter: string;
  clockAfterMs: number;
  moveTimeMs: number;
  by: Color;
}

export interface SerializableEngineState {
  gameId: string;
  whiteUserId: string | null;
  blackUserId: string | null;
  fen: string;
  fenHistory: string[];
  moves: EngineMove[];
  pendingDrawOfferBy: Color | null;
  clock: {
    whiteMs: number;
    blackMs: number;
    lastTickAt: number;
    incrementMs: number;
  };
  status: 'pending' | 'active' | 'completed' | 'aborted';
  result: GameResult | null;
  resultReason: GameResultReason | null;
}

export type WireMove = {
  ply: number;
  san: string;
  uci: string;
  fenAfter: string;
  clockAfterMs: number;
  moveTimeMs: number;
  by: Color;
};

export interface MoveIntent {
  uci?: string;
  from?: Square;
  to?: Square;
  promotion?: PieceType;
}

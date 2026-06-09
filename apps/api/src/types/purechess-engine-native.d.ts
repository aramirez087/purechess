declare module '@purechess/engine-native' {
  import type { GameResult, GameTermination } from '@purechess/shared';

  export interface NativeMoveOutcome {
    newFen: string;
    san: string;
    uci: string;
    isCapture: boolean;
    capturedPiece?: string | null;
    isCheck: boolean;
    isMate: boolean;
  }

  export interface NativeLegalMove {
    uci: string;
    san: string;
  }

  export interface NativeAdapterMove {
    ply: number;
    san: string;
    uci: string;
    fenAfter: string;
    by: 'w' | 'b';
  }

  export interface NativeAdapterClock {
    whiteMs: number | bigint;
    blackMs: number | bigint;
    lastTickAt: number | bigint;
    incrementMs: number;
  }

  export interface NativeAdapterGameState {
    fen: string;
    result?: GameResult | null;
    reason?: GameTermination | null;
    moves: NativeAdapterMove[];
  }

  export interface NativeAdapterPgnHeaders {
    event: string | null;
    site: string | null;
    date: string | null;
    white: string;
    black: string;
    result: string;
    timeControl: string | null;
    whiteElo: number | null;
    blackElo: number | null;
    eco: string | null;
  }

  export interface NativeAdapterParsedFen {
    piecePlacement: string;
    activeColor: 'w' | 'b';
    castling: string;
    enPassant: string | null;
    halfmoveClock: number;
    fullmoveNumber: number;
  }

  export interface NativeResultPayload {
    result: GameResult;
    reason: GameTermination;
  }

  export function validateMove(fen: string, uci: string): NativeMoveOutcome;
  export function legalMoves(fen: string): NativeLegalMove[];
  export function applyMoves(
    fen: string,
    ucis: string[],
    clock?: NativeAdapterClock,
  ): NativeAdapterGameState;
  export function detectResult(fen: string): NativeResultPayload | null;
  export function toPgn(fen: string, ucis: string[], headers: NativeAdapterPgnHeaders): string;
  export function parseFen(fen: string): NativeAdapterParsedFen;
}

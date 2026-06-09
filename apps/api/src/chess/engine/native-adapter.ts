import type * as NativeEngine from '@purechess/engine-native';
import { GameResult, GameTermination } from '@purechess/shared';
import type {
  EngineAdapter,
  MoveOutcome,
  LegalMove,
  AdapterMove,
  AdapterGameState,
  AdapterClock,
  AdapterPgnHeaders,
  AdapterParsedFen,
  ResultPayload,
} from './adapter';

type NativeModule = typeof NativeEngine;

export class NativeEngineAdapter implements EngineAdapter {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  private readonly _native: NativeModule = require('@purechess/engine-native') as NativeModule;

  name(): 'native' {
    return 'native';
  }

  async validateMove(fen: string, uci: string): Promise<MoveOutcome> {
    const r = this._native.validateMove(fen, uci);
    return {
      newFen: r.newFen,
      san: r.san,
      uci,
      isCapture: r.isCapture,
      capturedPiece: r.capturedPiece ?? null,
      isCheck: r.isCheck,
      isMate: r.isMate,
    };
  }

  async legalMoves(fen: string): Promise<LegalMove[]> {
    return this._native.legalMoves(fen);
  }

  async applyMoves(fen: string, ucis: string[], clock?: AdapterClock): Promise<AdapterGameState> {
    const nativeClock = clock
      ? {
          whiteMs: clock.whiteMs,
          blackMs: clock.blackMs,
          lastTickAt: clock.lastTickAt,
          incrementMs: clock.incrementMs,
        }
      : undefined;

    const r = this._native.applyMoves(fen, ucis, nativeClock);
    const moves: AdapterMove[] = r.moves.map((m) => ({
      ply: m.ply,
      san: m.san,
      uci: m.uci,
      fenAfter: m.fenAfter,
      by: m.by,
    }));

    return {
      fen: r.fen,
      result: (r.result as GameResult | undefined) ?? null,
      reason: (r.reason as GameTermination | undefined) ?? null,
      moves,
    };
  }

  async detectResult(fen: string): Promise<ResultPayload | null> {
    const r = this._native.detectResult(fen);
    if (!r) return null;
    return {
      result: r.result as GameResult,
      reason: r.reason as GameTermination,
    };
  }

  async toPgn(fen: string, ucis: string[], headers: AdapterPgnHeaders): Promise<string> {
    return this._native.toPgn(fen, ucis, {
      event: headers.event ?? null,
      site: headers.site ?? null,
      date: headers.date ?? null,
      white: headers.white,
      black: headers.black,
      result: headers.result,
      timeControl: headers.timeControl ?? null,
      whiteElo: headers.whiteElo ?? null,
      blackElo: headers.blackElo ?? null,
      eco: headers.eco ?? null,
    });
  }

  async parseFen(fen: string): Promise<AdapterParsedFen> {
    const r = this._native.parseFen(fen);
    return {
      piecePlacement: r.piecePlacement,
      activeColor: r.activeColor,
      castling: r.castling,
      enPassant: r.enPassant ?? null,
      halfmoveClock: r.halfmoveClock,
      fullmoveNumber: r.fullmoveNumber,
    };
  }
}

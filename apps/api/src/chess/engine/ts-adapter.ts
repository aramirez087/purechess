import { Chess } from 'chess.js';
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
import { buildPgn } from './pgn-builder';
import { fenPosition, halfmoveClock } from './fen-utils';

export class TsEngineAdapter implements EngineAdapter {
  name(): 'ts' {
    return 'ts';
  }

  async validateMove(fen: string, uci: string): Promise<MoveOutcome> {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length === 5 ? uci[4] : undefined;

    const chess = new Chess(fen);
    const move = chess.move({ from, to, promotion });

    return {
      newFen: chess.fen(),
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion ?? ''}`,
      isCapture: move.captured !== undefined,
      capturedPiece: move.captured ?? null,
      isCheck: chess.inCheck(),
      isMate: chess.isCheckmate(),
    };
  }

  async legalMoves(fen: string): Promise<LegalMove[]> {
    const chess = new Chess(fen);
    return chess.moves({ verbose: true }).map((m) => ({
      uci: `${m.from}${m.to}${m.promotion ?? ''}`,
      san: m.san,
    }));
  }

  async applyMoves(fen: string, ucis: string[], _clock?: AdapterClock): Promise<AdapterGameState> {
    const chess = new Chess(fen);
    const history: string[] = [fenPosition(fen)];
    const moves: AdapterMove[] = [];

    for (const uci of ucis) {
      // Stop if position is already terminal before applying this move
      const preResult = this._detectPositionResult(chess, history);
      if (preResult) {
        return { fen: chess.fen(), result: preResult.result, reason: preResult.reason, moves };
      }

      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length === 5 ? uci[4] : undefined;
      const move = chess.move({ from, to, promotion });

      moves.push({
        ply: moves.length + 1,
        san: move.san,
        uci: `${move.from}${move.to}${move.promotion ?? ''}`,
        fenAfter: chess.fen(),
        by: move.color as 'w' | 'b',
      });

      history.push(fenPosition(chess.fen()));

      // Threefold check (needs history)
      const currentKey = history[history.length - 1]!;
      const count = history.filter((k) => k === currentKey).length;
      if (count >= 3) {
        return {
          fen: chess.fen(),
          result: GameResult.Draw,
          reason: GameTermination.ThreefoldRepetition,
          moves,
        };
      }

      const postResult = this._detectPositionResult(chess, history);
      if (postResult) {
        return { fen: chess.fen(), result: postResult.result, reason: postResult.reason, moves };
      }
    }

    return { fen: chess.fen(), result: null, reason: null, moves };
  }

  async detectResult(fen: string): Promise<ResultPayload | null> {
    const chess = new Chess(fen);
    return this._detectPositionResult(chess, []);
  }

  async toPgn(fen: string, ucis: string[], headers: AdapterPgnHeaders): Promise<string> {
    const chess = new Chess(fen);
    const engineMoves = [];
    let ply = 1;

    for (const uci of ucis) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length === 5 ? uci[4] : undefined;
      const move = chess.move({ from, to, promotion });
      engineMoves.push({
        ply: ply++,
        san: move.san,
        uci: `${move.from}${move.to}${move.promotion ?? ''}`,
        fenAfter: chess.fen(),
        clockAfterMs: 0,
        moveTimeMs: 0,
        by: move.color as 'w' | 'b',
      });
    }

    return buildPgn(engineMoves, headers);
  }

  async parseFen(fen: string): Promise<AdapterParsedFen> {
    const parts = fen.split(' ');
    return {
      piecePlacement: parts[0] ?? '',
      activeColor: (parts[1] ?? 'w') as 'w' | 'b',
      castling: parts[2] ?? '-',
      enPassant: parts[3] === '-' ? null : (parts[3] ?? null),
      halfmoveClock: parseInt(parts[4] ?? '0', 10),
      fullmoveNumber: parseInt(parts[5] ?? '1', 10),
    };
  }

  private _detectPositionResult(chess: Chess, _history: string[]): ResultPayload | null {
    if (chess.isCheckmate()) {
      const sideToMove = chess.turn() as 'w' | 'b';
      const opponent: 'w' | 'b' = sideToMove === 'w' ? 'b' : 'w';
      return {
        result: opponent === 'w' ? GameResult.WhiteWins : GameResult.BlackWins,
        reason: GameTermination.Checkmate,
      };
    }
    if (chess.isStalemate()) {
      return { result: GameResult.Draw, reason: GameTermination.Stalemate };
    }
    if (chess.isInsufficientMaterial()) {
      return { result: GameResult.Draw, reason: GameTermination.InsufficientMaterial };
    }
    if (halfmoveClock(chess.fen()) >= 100) {
      return { result: GameResult.Draw, reason: GameTermination.FiftyMoveRule };
    }
    return null;
  }
}

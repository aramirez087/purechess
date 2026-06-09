import { Inject, Injectable } from '@nestjs/common';
import { Chess } from 'chess.js';
import {
  Color,
  EngineMove,
  GameResult,
  GameTermination,
  MoveIntent,
  SerializableEngineState,
} from '@purechess/shared';
import {
  CreateGameOpts,
  EngineState,
  InvalidMoveError,
  createGame,
  fromSerializable,
  toSerializable,
  unmakeMove,
} from './engine/game-state';
import {
  applyIncrement,
  isTimeout as isTimeoutFn,
  tickClock as tickClockFn,
} from './engine/clock';
import { fenPosition } from './engine/fen-utils';
import { PgnHeaders, buildPgn } from './engine/pgn-builder';
import { ENGINE_ADAPTER } from '../config/engine-backend.config';
import type { EngineAdapter, MoveOutcome } from './engine/adapter';

export type { EngineState, CreateGameOpts };
export { InvalidMoveError };

@Injectable()
export class EngineService {
  constructor(@Inject(ENGINE_ADAPTER) private readonly adapter: EngineAdapter) {}

  createGame(opts: CreateGameOpts): EngineState {
    return createGame(opts);
  }

  async applyMove(state: EngineState, intent: MoveIntent, nowMs: number): Promise<EngineState> {
    const sideToMove = state.position.turn() as Color;

    // Flag-fall check (bug-005): return early without appending a move
    if (isTimeoutFn(state.clock, nowMs, sideToMove)) {
      return {
        ...state,
        status: 'completed',
        result: sideToMove === 'w' ? GameResult.BlackWins : GameResult.WhiteWins,
        resultReason: GameTermination.Timeout,
      };
    }

    // Convert MoveIntent to UCI string for the adapter
    let uci: string;
    if (intent.uci) {
      uci = intent.uci;
    } else if (intent.from && intent.to) {
      uci = `${intent.from}${intent.to}${intent.promotion ?? ''}`;
    } else {
      throw new InvalidMoveError('Move intent must specify uci or from/to');
    }

    // Validate via adapter (throws for illegal moves)
    let outcome: MoveOutcome;
    try {
      outcome = await this.adapter.validateMove(state.position.fen(), uci);
    } catch {
      throw new InvalidMoveError('Illegal move');
    }

    const newChess = new Chess(outcome.newFen);

    // Clock logic stays in TS regardless of adapter
    const moveTimeMs = nowMs - Number(state.clock.lastTickAt);
    const ticked = tickClockFn(state.clock, nowMs, sideToMove);
    const withIncrement = applyIncrement(ticked, sideToMove);
    const clockAfterMs =
      sideToMove === 'w' ? Number(withIncrement.whiteMs) : Number(withIncrement.blackMs);

    const engineMove: EngineMove = {
      ply: state.moves.length + 1,
      san: outcome.san,
      uci: outcome.uci || uci,
      fenAfter: outcome.newFen,
      clockAfterMs,
      moveTimeMs,
      by: sideToMove,
    };

    const newFenHistory = [...state.fenHistory, fenPosition(outcome.newFen)];
    const newMoves = [...state.moves, engineMove];

    // Threefold check (needs history — always TS)
    const currentKey = newFenHistory[newFenHistory.length - 1]!;
    const count = newFenHistory.filter((k) => k === currentKey).length;
    if (count >= 3) {
      return {
        ...state,
        position: newChess,
        fenHistory: newFenHistory,
        moves: newMoves,
        clock: withIncrement,
        status: 'completed',
        result: GameResult.Draw,
        resultReason: GameTermination.ThreefoldRepetition,
      };
    }

    // Position-based result via adapter (no clock, no history)
    const detected = await this.adapter.detectResult(outcome.newFen);

    if (detected) {
      return {
        ...state,
        position: newChess,
        fenHistory: newFenHistory,
        moves: newMoves,
        clock: withIncrement,
        status: 'completed',
        result: detected.result,
        resultReason: detected.reason,
      };
    }

    return {
      ...state,
      position: newChess,
      fenHistory: newFenHistory,
      moves: newMoves,
      clock: withIncrement,
      status: state.status === 'pending' ? 'active' : state.status,
      result: null,
      resultReason: null,
    };
  }

  unmakeMove(state: EngineState): EngineState {
    return unmakeMove(state);
  }

  async detectResult(
    state: EngineState,
    nowMs: number,
  ): Promise<{ result: GameResult; reason: GameTermination } | null> {
    const sideToMove = state.position.turn() as Color;

    // Timeout (needs clock — always TS)
    if (isTimeoutFn(state.clock, nowMs, sideToMove)) {
      return {
        result: sideToMove === 'w' ? GameResult.BlackWins : GameResult.WhiteWins,
        reason: GameTermination.Timeout,
      };
    }

    // Threefold (needs history — always TS)
    if (state.fenHistory.length > 0) {
      const currentKey = state.fenHistory[state.fenHistory.length - 1]!;
      const count = state.fenHistory.filter((k) => k === currentKey).length;
      if (count >= 3) {
        return { result: GameResult.Draw, reason: GameTermination.ThreefoldRepetition };
      }
    }

    // Position-only check via adapter
    const detected = await this.adapter.detectResult(state.position.fen());
    if (!detected) return null;
    return { result: detected.result, reason: detected.reason };
  }

  toSerializable(state: EngineState): SerializableEngineState {
    return toSerializable(state);
  }

  fromSerializable(s: SerializableEngineState): EngineState {
    return fromSerializable(s);
  }

  buildPgn(moves: EngineMove[], headers: PgnHeaders): string {
    return buildPgn(moves, headers);
  }

  tickClock(state: EngineState, nowMs: number): EngineState {
    const sideToMove = state.position.turn() as Color;
    return { ...state, clock: tickClockFn(state.clock, nowMs, sideToMove) };
  }

  isTimeout(state: EngineState, nowMs: number): boolean {
    const sideToMove = state.position.turn() as Color;
    return isTimeoutFn(state.clock, nowMs, sideToMove);
  }
}

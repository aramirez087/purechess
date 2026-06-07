import { Injectable } from '@nestjs/common';
import { Color, EngineMove, GameResult, GameTermination, MoveIntent, SerializableEngineState } from '@purchess/shared';
import {
  CreateGameOpts,
  EngineState,
  InvalidMoveError,
  applyMove,
  createGame,
  fromSerializable,
  toSerializable,
  unmakeMove,
} from './engine/game-state';
import { detectResult } from './engine/result-detector';
import { isTimeout as isTimeoutFn, tickClock as tickClockFn } from './engine/clock';
import { PgnHeaders, buildPgn } from './engine/pgn-builder';

export type { EngineState, CreateGameOpts };
export { InvalidMoveError };

@Injectable()
export class EngineService {
  createGame(opts: CreateGameOpts): EngineState {
    return createGame(opts);
  }

  applyMove(state: EngineState, intent: MoveIntent, nowMs: number): EngineState {
    return applyMove(state, intent, nowMs);
  }

  unmakeMove(state: EngineState): EngineState {
    return unmakeMove(state);
  }

  detectResult(
    state: EngineState,
    nowMs: number,
  ): { result: GameResult; reason: GameTermination } | null {
    return detectResult(state.position, state.fenHistory, state.clock, nowMs);
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

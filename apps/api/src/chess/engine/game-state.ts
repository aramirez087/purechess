import { Chess } from 'chess.js';
import {
  Color,
  EngineMove,
  GameResult,
  GameTermination,
  MoveIntent,
  SerializableEngineState,
} from '@purchess/shared';
import { ClockSnapshot, applyIncrement, isTimeout, makeClock, serializeClock, tickClock } from './clock';
import { detectResult } from './result-detector';
import { fenPosition, startingFen } from './fen-utils';
import { validateMove } from './move-validator';

export type EngineState = {
  gameId: string;
  whiteUserId: string | null;
  blackUserId: string | null;
  position: Chess;
  fenHistory: string[];
  moves: EngineMove[];
  pendingDrawOfferBy: Color | null;
  clock: ClockSnapshot;
  status: 'pending' | 'active' | 'completed' | 'aborted';
  result: GameResult | null;
  resultReason: GameTermination | null;
};

export interface CreateGameOpts {
  gameId: string;
  whiteUserId: string | null;
  blackUserId: string | null;
  timeMs: number;
  incrementMs: number;
  nowMs: number;
}

export class InvalidMoveError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'InvalidMoveError';
  }
}

export function createGame(opts: CreateGameOpts): EngineState {
  const { gameId, whiteUserId, blackUserId, timeMs, incrementMs, nowMs } = opts;
  const fen = startingFen();
  return {
    gameId,
    whiteUserId,
    blackUserId,
    position: new Chess(),
    fenHistory: [fenPosition(fen)],
    moves: [],
    pendingDrawOfferBy: null,
    clock: makeClock(timeMs, timeMs, incrementMs, nowMs),
    status: 'pending',
    result: null,
    resultReason: null,
  };
}

export function applyMove(state: EngineState, intent: MoveIntent, nowMs: number): EngineState {
  const sideToMove = state.position.turn() as Color;

  if (isTimeout(state.clock, nowMs, sideToMove)) {
    return {
      ...state,
      status: 'completed',
      result: sideToMove === 'w' ? GameResult.BlackWins : GameResult.WhiteWins,
      resultReason: GameTermination.Timeout,
    };
  }

  const validation = validateMove(state.position, intent);
  if (!validation.ok) {
    throw new InvalidMoveError(validation.reason);
  }

  const moveTimeMs = nowMs - Number(state.clock.lastTickAt);
  const ticked = tickClock(state.clock, nowMs, sideToMove);
  const withIncrement = applyIncrement(ticked, sideToMove);

  const { newChess, san, uci } = validation;
  const clockAfterMs =
    sideToMove === 'w' ? Number(withIncrement.whiteMs) : Number(withIncrement.blackMs);

  const engineMove: EngineMove = {
    ply: state.moves.length + 1,
    san,
    uci,
    fenAfter: newChess.fen(),
    clockAfterMs,
    moveTimeMs,
    by: sideToMove,
  };

  const newFenHistory = [...state.fenHistory, fenPosition(newChess.fen())];
  const newMoves = [...state.moves, engineMove];
  const detected = detectResult(newChess, newFenHistory, withIncrement, nowMs);

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

export function unmakeMove(state: EngineState): EngineState {
  if (state.moves.length === 0) {
    throw new Error('No moves to unmake');
  }
  const prevMoves = state.moves.slice(0, -1);
  const prevFen =
    prevMoves.length > 0 ? prevMoves[prevMoves.length - 1]!.fenAfter : startingFen();
  const prevFenHistory = state.fenHistory.slice(0, -1);
  return {
    ...state,
    position: new Chess(prevFen),
    moves: prevMoves,
    fenHistory: prevFenHistory,
    status: prevMoves.length === 0 ? 'pending' : state.status,
    result: null,
    resultReason: null,
  };
}

export function toSerializable(state: EngineState): SerializableEngineState {
  return {
    gameId: state.gameId,
    whiteUserId: state.whiteUserId,
    blackUserId: state.blackUserId,
    fen: state.position.fen(),
    fenHistory: state.fenHistory,
    moves: state.moves,
    pendingDrawOfferBy: state.pendingDrawOfferBy,
    clock: serializeClock(state.clock),
    status: state.status,
    result: state.result,
    resultReason: state.resultReason,
  };
}

export function fromSerializable(s: SerializableEngineState): EngineState {
  return {
    gameId: s.gameId,
    whiteUserId: s.whiteUserId,
    blackUserId: s.blackUserId,
    position: new Chess(s.fen),
    fenHistory: s.fenHistory,
    moves: s.moves,
    pendingDrawOfferBy: s.pendingDrawOfferBy,
    clock: {
      whiteMs: BigInt(s.clock.whiteMs),
      blackMs: BigInt(s.clock.blackMs),
      lastTickAt: BigInt(s.clock.lastTickAt),
      incrementMs: BigInt(s.clock.incrementMs),
    },
    status: s.status,
    result: s.result,
    resultReason: s.resultReason,
  };
}

import { GameResult, GameTermination } from '@purechess/shared';
import { applyMove, createGame, fromSerializable, toSerializable, unmakeMove, InvalidMoveError } from '../../src/chess/engine/game-state';
import { startingFen } from '../../src/chess/engine/fen-utils';

const BASE_OPTS = {
  gameId: 'test-game',
  whiteUserId: 'white-user',
  blackUserId: 'black-user',
  timeMs: 300000,
  incrementMs: 0,
  nowMs: 1000000,
};

describe('game-state', () => {
  it('createGame returns pending state with correct initial clock', () => {
    const state = createGame(BASE_OPTS);
    expect(state.status).toBe('pending');
    expect(state.clock.whiteMs).toBe(300000n);
    expect(state.clock.blackMs).toBe(300000n);
    expect(state.moves).toHaveLength(0);
    expect(state.result).toBeNull();
    expect(state.position.fen()).toBe(startingFen());
  });

  it('applyMove activates game on first move', () => {
    const state = createGame(BASE_OPTS);
    const next = applyMove(state, { uci: 'e2e4' }, 1001000);
    expect(next.status).toBe('active');
    expect(next.moves).toHaveLength(1);
  });

  it('applyMove records correct move data', () => {
    const state = createGame(BASE_OPTS);
    const next = applyMove(state, { uci: 'e2e4' }, 1001000);
    const move = next.moves[0]!;
    expect(move.ply).toBe(1);
    expect(move.san).toBe('e4');
    expect(move.uci).toBe('e2e4');
    expect(move.by).toBe('w');
    expect(move.moveTimeMs).toBe(1000);
  });

  it("Scholar's mate produces completed state with white wins", () => {
    let state = createGame(BASE_OPTS);
    const scholarsMateMoves = [
      { uci: 'e2e4' }, { uci: 'e7e5' },
      { uci: 'd1h5' }, { uci: 'b8c6' },
      { uci: 'f1c4' }, { uci: 'g8f6' },
      { uci: 'h5f7' },
    ];
    let nowMs = 1001000;
    for (const intent of scholarsMateMoves) {
      state = applyMove(state, intent, nowMs);
      nowMs += 1000;
    }
    expect(state.status).toBe('completed');
    expect(state.result).toBe(GameResult.WhiteWins);
    expect(state.resultReason).toBe(GameTermination.Checkmate);
    expect(state.moves).toHaveLength(7);
  });

  it('throws InvalidMoveError for illegal move', () => {
    const state = createGame(BASE_OPTS);
    expect(() => applyMove(state, { uci: 'e2e5' }, 1001000)).toThrow(InvalidMoveError);
  });

  it('throws InvalidMoveError for wrong turn', () => {
    const state = createGame(BASE_OPTS);
    expect(() => applyMove(state, { uci: 'e7e5' }, 1001000)).toThrow(InvalidMoveError);
  });

  it('unmakeMove restores previous position', () => {
    const state = createGame(BASE_OPTS);
    const afterMove = applyMove(state, { uci: 'e2e4' }, 1001000);
    const restored = unmakeMove(afterMove);
    expect(restored.position.fen()).toBe(startingFen());
    expect(restored.moves).toHaveLength(0);
    expect(restored.status).toBe('pending');
  });

  it('unmakeMove throws when no moves to undo', () => {
    const state = createGame(BASE_OPTS);
    expect(() => unmakeMove(state)).toThrow('No moves to unmake');
  });

  it('toSerializable is JSON round-trippable', () => {
    let state = createGame(BASE_OPTS);
    state = applyMove(state, { uci: 'e2e4' }, 1001000);
    state = applyMove(state, { uci: 'e7e5' }, 1002000);

    const serialized = toSerializable(state);
    const json = JSON.stringify(serialized);
    const parsed = JSON.parse(json);
    const restored = fromSerializable(parsed);

    expect(restored.fen ?? restored.position.fen()).toBe(state.position.fen());
    expect(restored.fenHistory).toEqual(state.fenHistory);
    expect(restored.moves).toHaveLength(2);
    expect(restored.clock.whiteMs).toBe(state.clock.whiteMs);
    expect(restored.clock.blackMs).toBe(state.clock.blackMs);
  });

  it('toSerializable contains no BigInt values (JSON safe)', () => {
    const state = createGame(BASE_OPTS);
    const serialized = toSerializable(state);
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });

  it('produces deterministic state from same move sequence', () => {
    const moves = [
      { uci: 'e2e4' }, { uci: 'e7e5' },
      { uci: 'g1f3' }, { uci: 'b8c6' },
    ];

    function runGame() {
      let state = createGame(BASE_OPTS);
      let nowMs = 1001000;
      for (const intent of moves) {
        state = applyMove(state, intent, nowMs);
        nowMs += 1000;
      }
      return state;
    }

    const state1 = runGame();
    const state2 = runGame();
    expect(state1.position.fen()).toBe(state2.position.fen());
    expect(state1.fenHistory).toEqual(state2.fenHistory);
    expect(state1.moves.map((m) => m.san)).toEqual(state2.moves.map((m) => m.san));
  });

  it('timeout before move returns completed state', () => {
    const state = createGame({ ...BASE_OPTS, timeMs: 1000 });
    const result = applyMove(state, { uci: 'e2e4' }, 1002000);
    expect(result.status).toBe('completed');
    expect(result.result).toBe(GameResult.BlackWins);
    expect(result.resultReason).toBe(GameTermination.Timeout);
  });

  it('clock decrements and increment applies after move', () => {
    const state = createGame({ ...BASE_OPTS, incrementMs: 2000 });
    const next = applyMove(state, { uci: 'e2e4' }, 1005000);
    const whiteRemaining = Number(next.clock.whiteMs);
    expect(whiteRemaining).toBe(300000 - 5000 + 2000);
  });
});

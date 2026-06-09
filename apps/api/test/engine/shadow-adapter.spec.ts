import { ShadowAdapter } from '../../src/chess/engine/shadow-adapter';
import type {
  EngineAdapter,
  LegalMove,
  MoveOutcome,
  AdapterGameState,
  ResultPayload,
  AdapterParsedFen,
  AdapterPgnHeaders,
} from '../../src/chess/engine/adapter';
import { GameResult, GameTermination } from '@purechess/shared';

const STARTPOS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

const BASE_OUTCOME: MoveOutcome = {
  newFen: AFTER_E4, san: 'e4', uci: 'e2e4', isCapture: false,
  capturedPiece: null, isCheck: false, isMate: false,
};
const BASE_STATE: AdapterGameState = {
  fen: AFTER_E4, result: null, reason: null, moves: [],
};
const BASE_PARSED: AdapterParsedFen = {
  piecePlacement: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
  activeColor: 'w', castling: 'KQkq', enPassant: null,
  halfmoveClock: 0, fullmoveNumber: 1,
};

function mockAdapter(overrides: Partial<EngineAdapter> = {}): jest.Mocked<EngineAdapter> {
  return {
    name: jest.fn().mockReturnValue('ts'),
    validateMove: jest.fn().mockResolvedValue(BASE_OUTCOME),
    legalMoves: jest.fn().mockResolvedValue([{ uci: 'e2e4', san: 'e4' }] satisfies LegalMove[]),
    applyMoves: jest.fn().mockResolvedValue(BASE_STATE),
    detectResult: jest.fn().mockResolvedValue(null),
    toPgn: jest.fn().mockResolvedValue('[Event ""]\n\n1. e4 *'),
    parseFen: jest.fn().mockResolvedValue(BASE_PARSED),
    ...overrides,
  } as jest.Mocked<EngineAdapter>;
}

describe('ShadowAdapter', () => {
  it('name() returns shadow-ts', () => {
    const adapter = new ShadowAdapter(mockAdapter(), mockAdapter());
    expect(adapter.name()).toBe('shadow-ts');
  });

  describe('validateMove', () => {
    it('returns ts result on agreement', async () => {
      const ts = mockAdapter();
      const native = mockAdapter();
      const shadow = new ShadowAdapter(ts, native);
      const result = await shadow.validateMove(STARTPOS, 'e2e4');
      expect(result.san).toBe('e4');
    });

    it('returns ts result even on divergence; logs warning', async () => {
      const nativeOutcome: MoveOutcome = { ...BASE_OUTCOME, san: 'e4!!' };
      const ts = mockAdapter({ validateMove: jest.fn().mockResolvedValue(BASE_OUTCOME) });
      const native = mockAdapter({ validateMove: jest.fn().mockResolvedValue(nativeOutcome) });
      const warnings: unknown[] = [];
      const shadow = new ShadowAdapter(ts, native, { warn: (_, ctx) => warnings.push(ctx) });
      const result = await shadow.validateMove(STARTPOS, 'e2e4');
      expect(result.san).toBe('e4');
      expect(warnings).toHaveLength(1);
    });

    it('rethrows ts error', async () => {
      const ts = mockAdapter({ validateMove: jest.fn().mockRejectedValue(new Error('illegal')) });
      const shadow = new ShadowAdapter(ts, mockAdapter());
      await expect(shadow.validateMove(STARTPOS, 'e2e5')).rejects.toThrow('illegal');
    });

    it('logs divergence when ts succeeds but native throws', async () => {
      const ts = mockAdapter();
      const native = mockAdapter({ validateMove: jest.fn().mockRejectedValue(new Error('bad')) });
      const warnings: unknown[] = [];
      const shadow = new ShadowAdapter(ts, native, { warn: (_, ctx) => warnings.push(ctx) });
      await shadow.validateMove(STARTPOS, 'e2e4');
      expect(warnings).toHaveLength(1);
    });

    it('both-reject → treated as agreement, no divergence', async () => {
      const err = new Error('invalid fen');
      const ts = mockAdapter({ validateMove: jest.fn().mockRejectedValue(err) });
      const native = mockAdapter({ validateMove: jest.fn().mockRejectedValue(err) });
      const warnings: unknown[] = [];
      const shadow = new ShadowAdapter(ts, native, { warn: (_, ctx) => warnings.push(ctx) });
      await expect(shadow.validateMove('bad-fen', 'e2e4')).rejects.toThrow('invalid fen');
      expect(warnings).toHaveLength(0);
    });
  });

  describe('legalMoves', () => {
    it('returns ts moves; sorts before comparison (order-independent)', async () => {
      const moves1: LegalMove[] = [{ uci: 'e2e4', san: 'e4' }, { uci: 'a2a4', san: 'a4' }];
      const moves2: LegalMove[] = [{ uci: 'a2a4', san: 'a4' }, { uci: 'e2e4', san: 'e4' }];
      const ts = mockAdapter({ legalMoves: jest.fn().mockResolvedValue(moves1) });
      const native = mockAdapter({ legalMoves: jest.fn().mockResolvedValue(moves2) });
      const warnings: unknown[] = [];
      const shadow = new ShadowAdapter(ts, native, { warn: (_, ctx) => warnings.push(ctx) });
      const result = await shadow.legalMoves(STARTPOS);
      expect(result).toBe(moves1);
      expect(warnings).toHaveLength(0);
    });

    it('logs divergence when move sets differ', async () => {
      const ts = mockAdapter({ legalMoves: jest.fn().mockResolvedValue([{ uci: 'e2e4', san: 'e4' }]) });
      const native = mockAdapter({ legalMoves: jest.fn().mockResolvedValue([{ uci: 'd2d4', san: 'd4' }]) });
      const warnings: unknown[] = [];
      const shadow = new ShadowAdapter(ts, native, { warn: (_, ctx) => warnings.push(ctx) });
      await shadow.legalMoves(STARTPOS);
      expect(warnings).toHaveLength(1);
    });

    it('handles native rejection', async () => {
      const native = mockAdapter({ legalMoves: jest.fn().mockRejectedValue(new Error('bad')) });
      const warnings: unknown[] = [];
      const shadow = new ShadowAdapter(mockAdapter(), native, { warn: (_, ctx) => warnings.push(ctx) });
      await shadow.legalMoves(STARTPOS);
      expect(warnings).toHaveLength(1);
    });
  });

  describe('applyMoves', () => {
    it('returns ts state on agreement', async () => {
      const shadow = new ShadowAdapter(mockAdapter(), mockAdapter());
      const result = await shadow.applyMoves(STARTPOS, ['e2e4']);
      expect(result.fen).toBe(AFTER_E4);
    });

    it('logs divergence when states differ', async () => {
      const different: AdapterGameState = { ...BASE_STATE, fen: 'different' };
      const ts = mockAdapter({ applyMoves: jest.fn().mockResolvedValue(BASE_STATE) });
      const native = mockAdapter({ applyMoves: jest.fn().mockResolvedValue(different) });
      const warnings: unknown[] = [];
      const shadow = new ShadowAdapter(ts, native, { warn: (_, ctx) => warnings.push(ctx) });
      await shadow.applyMoves(STARTPOS, ['e2e4']);
      expect(warnings).toHaveLength(1);
    });

    it('rethrows ts error', async () => {
      const ts = mockAdapter({ applyMoves: jest.fn().mockRejectedValue(new Error('bad fen')) });
      const shadow = new ShadowAdapter(ts, mockAdapter());
      await expect(shadow.applyMoves('bad', [])).rejects.toThrow('bad fen');
    });
  });

  describe('detectResult', () => {
    it('both return null → no divergence', async () => {
      const warnings: unknown[] = [];
      const shadow = new ShadowAdapter(mockAdapter(), mockAdapter(), { warn: (_, ctx) => warnings.push(ctx) });
      const result = await shadow.detectResult(STARTPOS);
      expect(result).toBeNull();
      expect(warnings).toHaveLength(0);
    });

    it('differing results → divergence logged, ts wins', async () => {
      const payload: ResultPayload = { result: GameResult.Draw, reason: GameTermination.Stalemate };
      const native = mockAdapter({ detectResult: jest.fn().mockResolvedValue(payload) });
      const warnings: unknown[] = [];
      const shadow = new ShadowAdapter(mockAdapter(), native, { warn: (_, ctx) => warnings.push(ctx) });
      const result = await shadow.detectResult(STARTPOS);
      expect(result).toBeNull();
      expect(warnings).toHaveLength(1);
    });
  });

  describe('toPgn', () => {
    it('returns ts pgn on agreement', async () => {
      const headers: AdapterPgnHeaders = { white: 'W', black: 'B', result: '*' };
      const shadow = new ShadowAdapter(mockAdapter(), mockAdapter());
      const result = await shadow.toPgn(STARTPOS, ['e2e4'], headers);
      expect(result).toContain('e4');
    });

    it('logs divergence when PGNs differ', async () => {
      const headers: AdapterPgnHeaders = { white: 'W', black: 'B', result: '*' };
      const native = mockAdapter({ toPgn: jest.fn().mockResolvedValue('[different PGN]') });
      const warnings: unknown[] = [];
      const shadow = new ShadowAdapter(mockAdapter(), native, { warn: (_, ctx) => warnings.push(ctx) });
      await shadow.toPgn(STARTPOS, ['e2e4'], headers);
      expect(warnings).toHaveLength(1);
    });
  });

  describe('parseFen', () => {
    it('returns ts parsed on agreement', async () => {
      const shadow = new ShadowAdapter(mockAdapter(), mockAdapter());
      const result = await shadow.parseFen(STARTPOS);
      expect(result.activeColor).toBe('w');
    });

    it('logs divergence when parsed fens differ', async () => {
      const different: AdapterParsedFen = { ...BASE_PARSED, activeColor: 'b' };
      const native = mockAdapter({ parseFen: jest.fn().mockResolvedValue(different) });
      const warnings: unknown[] = [];
      const shadow = new ShadowAdapter(mockAdapter(), native, { warn: (_, ctx) => warnings.push(ctx) });
      await shadow.parseFen(STARTPOS);
      expect(warnings).toHaveLength(1);
    });
  });
});

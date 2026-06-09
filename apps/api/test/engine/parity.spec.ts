import { TsEngineAdapter } from '../../src/chess/engine/ts-adapter';
import { runShadowSuite } from '../../src/chess/engine/shadow-runner';
import type { GameTrace } from '../../src/chess/engine/shadow-runner';
import type { EngineAdapter, LegalMove, MoveOutcome, AdapterGameState, ResultPayload } from '../../src/chess/engine/adapter';
import { GameResult, GameTermination } from '@purechess/shared';
import allTraces from '../../src/chess/engine/__fixtures__/game-traces.json';

const traces = allTraces as GameTrace[];

const STARTPOS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4  = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

const BASE_OUTCOME: MoveOutcome = {
  newFen: AFTER_E4, san: 'e4', uci: 'e2e4',
  isCapture: false, capturedPiece: null, isCheck: false, isMate: false,
};
const BASE_STATE: AdapterGameState = { fen: AFTER_E4, result: null, reason: null, moves: [] };

/** Returns an adapter that delegates to TsEngineAdapter except for the provided overrides. */
function badAdapter(overrides: Partial<EngineAdapter>): EngineAdapter {
  const real = new TsEngineAdapter();
  return {
    name: () => 'ts' as const,
    validateMove: (fen: string, uci: string) => real.validateMove(fen, uci),
    legalMoves: (fen: string) => real.legalMoves(fen),
    applyMoves: (fen: string, ucis: string[], clock?: import('../../src/chess/engine/adapter').AdapterClock) => real.applyMoves(fen, ucis, clock),
    detectResult: (fen: string) => real.detectResult(fen),
    toPgn: (fen: string, ucis: string[], headers: import('../../src/chess/engine/adapter').AdapterPgnHeaders) => real.toPgn(fen, ucis, headers),
    parseFen: (fen: string) => real.parseFen(fen),
    ...overrides,
  } as EngineAdapter;
}

const ONE_MOVE_TRACE: GameTrace = { name: 'single-e4', startFen: STARTPOS, ucis: ['e2e4'] };

describe('engine parity — 10-trace subset (ts vs ts)', () => {
  it('has 0 divergences between two TsEngineAdapter instances', async () => {
    const subset = traces.slice(0, 10);
    const ts1 = new TsEngineAdapter();
    const ts2 = new TsEngineAdapter();
    const summary = await runShadowSuite(subset, ts1, ts2);
    if (summary.divergences > 0) {
      console.error('Divergences:', JSON.stringify(summary.divergenceDetails, null, 2));
    }
    expect(summary.tracesRun).toBe(10);
    expect(summary.divergences).toBe(0);
  }, 60_000);
});

describe('runShadowSuite — divergence detection', () => {
  it('detects validateMove divergence', async () => {
    const wrongOutcome: MoveOutcome = { ...BASE_OUTCOME, san: 'e4!!' };
    const native = badAdapter({ validateMove: jest.fn().mockResolvedValue(wrongOutcome) });
    const summary = await runShadowSuite([ONE_MOVE_TRACE], new TsEngineAdapter(), native);
    const vd = summary.divergenceDetails.filter(d => d.method === 'validateMove');
    expect(vd.length).toBeGreaterThan(0);
  }, 30_000);

  it('detects legalMoves divergence', async () => {
    const wrongMoves: LegalMove[] = [{ uci: 'a1a1', san: '--' }];
    const native = badAdapter({ legalMoves: jest.fn().mockResolvedValue(wrongMoves) });
    const summary = await runShadowSuite([ONE_MOVE_TRACE], new TsEngineAdapter(), native);
    const ld = summary.divergenceDetails.filter(d => d.method === 'legalMoves');
    expect(ld.length).toBeGreaterThan(0);
  }, 30_000);

  it('detects detectResult divergence', async () => {
    const wrongResult: ResultPayload = { result: GameResult.Draw, reason: GameTermination.Stalemate };
    const native = badAdapter({ detectResult: jest.fn().mockResolvedValue(wrongResult) });
    const summary = await runShadowSuite([ONE_MOVE_TRACE], new TsEngineAdapter(), native);
    const dd = summary.divergenceDetails.filter(d => d.method === 'detectResult');
    expect(dd.length).toBeGreaterThan(0);
  }, 30_000);

  it('detects applyMoves divergence', async () => {
    const wrongState: AdapterGameState = { ...BASE_STATE, fen: 'wrong/fen/here 8/8 w - - 0 1' };
    const native = badAdapter({ applyMoves: jest.fn().mockResolvedValue(wrongState) });
    const summary = await runShadowSuite([ONE_MOVE_TRACE], new TsEngineAdapter(), native);
    const ad = summary.divergenceDetails.filter(d => d.method === 'applyMoves');
    expect(ad.length).toBeGreaterThan(0);
  }, 30_000);

  it('handles adapter rejection (settled catch branch)', async () => {
    const native = badAdapter({ validateMove: jest.fn().mockRejectedValue(new Error('kaboom')) });
    const summary = await runShadowSuite([ONE_MOVE_TRACE], new TsEngineAdapter(), native);
    // ts succeeded, native threw → divergence captured, no unhandled rejection
    const vd = summary.divergenceDetails.filter(d => d.method === 'validateMove');
    expect(vd.length).toBeGreaterThan(0);
  }, 30_000);

  it('returns 0 divergences when both adapters agree', async () => {
    const ts1 = new TsEngineAdapter();
    const ts2 = new TsEngineAdapter();
    const summary = await runShadowSuite([ONE_MOVE_TRACE], ts1, ts2);
    expect(summary.divergences).toBe(0);
  }, 30_000);
});

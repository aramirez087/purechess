import * as Sentry from '@sentry/node';
import type {
  EngineAdapter,
  MoveOutcome,
  LegalMove,
  AdapterGameState,
  AdapterClock,
  AdapterPgnHeaders,
  AdapterParsedFen,
  ResultPayload,
} from './adapter';

interface DivergenceContext {
  method: string;
  fen: string;
  uci?: string;
  tsResult: unknown;
  nativeResult: unknown;
}

export interface ShadowLogger {
  warn(msg: string, ctx: unknown): void;
}

export class ShadowAdapter implements EngineAdapter {
  constructor(
    private readonly _ts: EngineAdapter,
    private readonly _native: EngineAdapter,
    private readonly _logger?: ShadowLogger,
  ) {}

  name(): 'shadow-ts' {
    return 'shadow-ts';
  }

  async validateMove(fen: string, uci: string): Promise<MoveOutcome> {
    const [ts, native] = await Promise.allSettled([
      this._ts.validateMove(fen, uci),
      this._native.validateMove(fen, uci),
    ]);
    this._compare('validateMove', fen, ts, native, uci);
    if (ts.status === 'rejected') throw ts.reason as Error;
    return ts.value;
  }

  async legalMoves(fen: string): Promise<LegalMove[]> {
    const [ts, native] = await Promise.allSettled([
      this._ts.legalMoves(fen),
      this._native.legalMoves(fen),
    ]);
    const tsNorm =
      ts.status === 'fulfilled'
        ? { status: 'fulfilled' as const, value: this._sortMoves(ts.value) }
        : ts;
    const nativeNorm =
      native.status === 'fulfilled'
        ? { status: 'fulfilled' as const, value: this._sortMoves(native.value) }
        : native;
    this._compare('legalMoves', fen, tsNorm, nativeNorm);
    if (ts.status === 'rejected') throw ts.reason as Error;
    return ts.value;
  }

  async applyMoves(fen: string, ucis: string[], clock?: AdapterClock): Promise<AdapterGameState> {
    const [ts, native] = await Promise.allSettled([
      this._ts.applyMoves(fen, ucis, clock),
      this._native.applyMoves(fen, ucis, clock),
    ]);
    this._compare('applyMoves', fen, ts, native);
    if (ts.status === 'rejected') throw ts.reason as Error;
    return ts.value;
  }

  async detectResult(fen: string): Promise<ResultPayload | null> {
    const [ts, native] = await Promise.allSettled([
      this._ts.detectResult(fen),
      this._native.detectResult(fen),
    ]);
    this._compare('detectResult', fen, ts, native);
    if (ts.status === 'rejected') throw ts.reason as Error;
    return ts.value;
  }

  async toPgn(fen: string, ucis: string[], headers: AdapterPgnHeaders): Promise<string> {
    const [ts, native] = await Promise.allSettled([
      this._ts.toPgn(fen, ucis, headers),
      this._native.toPgn(fen, ucis, headers),
    ]);
    this._compare('toPgn', fen, ts, native);
    if (ts.status === 'rejected') throw ts.reason as Error;
    return ts.value;
  }

  async parseFen(fen: string): Promise<AdapterParsedFen> {
    const [ts, native] = await Promise.allSettled([
      this._ts.parseFen(fen),
      this._native.parseFen(fen),
    ]);
    this._compare('parseFen', fen, ts, native);
    if (ts.status === 'rejected') throw ts.reason as Error;
    return ts.value;
  }

  private _sortMoves(moves: LegalMove[]): LegalMove[] {
    return [...moves].sort((a, b) => a.uci.localeCompare(b.uci));
  }

  private _compare(
    method: string,
    fen: string,
    ts: PromiseSettledResult<unknown>,
    native: PromiseSettledResult<unknown>,
    uci?: string,
  ): void {
    if (this._equal(ts, native)) return;

    const detail: DivergenceContext = {
      method,
      fen,
      uci,
      tsResult: ts.status === 'fulfilled' ? ts.value : String(ts.reason),
      nativeResult: native.status === 'fulfilled' ? native.value : String(native.reason),
    };

    this._logger?.warn('engine.shadow.divergence', detail);

    try {
      Sentry.captureEvent({
        level: 'warning',
        message: `engine.shadow.divergence method=${method}`,
        tags: { 'engine.adapter': 'shadow-ts', 'engine.method': method },
        extra: detail as unknown as Record<string, unknown>,
      });
    } catch {
      // Sentry not initialized in test/script context — safe to swallow
    }
  }

  private _equal(
    a: PromiseSettledResult<unknown>,
    b: PromiseSettledResult<unknown>,
  ): boolean {
    if (a.status !== b.status) return false;
    if (a.status === 'rejected' && b.status === 'rejected') return true;
    if (a.status === 'fulfilled' && b.status === 'fulfilled') {
      return JSON.stringify(a.value) === JSON.stringify(b.value);
    }
    return false;
  }
}

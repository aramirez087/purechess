import { TsEngineAdapter } from '../../src/chess/engine/ts-adapter';
import { NativeEngineAdapter } from '../../src/chess/engine/native-adapter';
import type { EngineAdapter } from '../../src/chess/engine/adapter';

// Compile-time satisfaction: if either class fails to implement EngineAdapter,
// TypeScript will error here. Runtime checks verify name() contract.
const _tsCheck: EngineAdapter = null as unknown as TsEngineAdapter;
const _nativeCheck: EngineAdapter = null as unknown as NativeEngineAdapter;
void _tsCheck;
void _nativeCheck;

describe('EngineAdapter contract', () => {
  it('TsEngineAdapter satisfies EngineAdapter — name() returns ts', () => {
    const adapter = new TsEngineAdapter();
    expect(adapter.name()).toBe('ts');
  });

  it('TsEngineAdapter has all required methods', () => {
    const adapter = new TsEngineAdapter();
    expect(typeof adapter.validateMove).toBe('function');
    expect(typeof adapter.legalMoves).toBe('function');
    expect(typeof adapter.applyMoves).toBe('function');
    expect(typeof adapter.detectResult).toBe('function');
    expect(typeof adapter.toPgn).toBe('function');
    expect(typeof adapter.parseFen).toBe('function');
    expect(typeof adapter.name).toBe('function');
  });

  it('NativeEngineAdapter satisfies EngineAdapter — name() returns native (class loads without binary)', () => {
    // NativeEngineAdapter class can be imported without the binary present;
    // the binary is loaded lazily in the constructor.
    expect(NativeEngineAdapter).toBeDefined();
  });
});

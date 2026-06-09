import { NativeEngineAdapter } from '../../src/chess/engine/native-adapter';
import { TsEngineAdapter } from '../../src/chess/engine/ts-adapter';

const STARTPOS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

let skip = false;

beforeAll(() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@purechess/engine-native');
  } catch {
    skip = true;
  }
});

describe('NativeEngineAdapter', () => {
  it('class can be imported without the binary present', () => {
    expect(NativeEngineAdapter).toBeDefined();
  });

  it('name() returns native', () => {
    if (skip) {
      console.log('Skipping native tests — purechess-engine-native binary not available');
      return;
    }
    expect(new NativeEngineAdapter().name()).toBe('native');
  });

  it('validateMove matches TsEngineAdapter for 1.e4', async () => {
    if (skip) return;
    const native = new NativeEngineAdapter();
    const ts = new TsEngineAdapter();
    const [nativeResult, tsResult] = await Promise.all([
      native.validateMove(STARTPOS, 'e2e4'),
      ts.validateMove(STARTPOS, 'e2e4'),
    ]);
    expect(nativeResult.san).toBe(tsResult.san);
    expect(nativeResult.newFen).toBe(tsResult.newFen);
    expect(nativeResult.isCapture).toBe(tsResult.isCapture);
    expect(nativeResult.isCheck).toBe(tsResult.isCheck);
    expect(nativeResult.isMate).toBe(tsResult.isMate);
  });

  it('legalMoves count matches TsEngineAdapter for startpos', async () => {
    if (skip) return;
    const native = new NativeEngineAdapter();
    const ts = new TsEngineAdapter();
    const [nativeMoves, tsMoves] = await Promise.all([
      native.legalMoves(STARTPOS),
      ts.legalMoves(STARTPOS),
    ]);
    expect(nativeMoves).toHaveLength(tsMoves.length);
  });

  it('detectResult returns null at startpos', async () => {
    if (skip) return;
    const native = new NativeEngineAdapter();
    expect(await native.detectResult(STARTPOS)).toBeNull();
  });
});

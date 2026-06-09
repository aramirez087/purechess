export * from './clock';
export * from './fen-utils';
export * from './game-state';
export * from './move-validator';
export * from './pgn-builder';
export * from './adapter';
export { TsEngineAdapter } from './ts-adapter';
export { NativeEngineAdapter } from './native-adapter';
export { ShadowAdapter } from './shadow-adapter';

import type { EngineAdapter } from './adapter';
import { TsEngineAdapter } from './ts-adapter';
import { NativeEngineAdapter } from './native-adapter';
import { ShadowAdapter } from './shadow-adapter';

let _nativeAvailable = false;
try {
  require('@purechess/engine-native');
  _nativeAvailable = true;
} catch {
  _nativeAvailable = false;
}

function buildEngine(): EngineAdapter {
  if (process.env.ENGINE_SHADOW === '1') {
    if (!_nativeAvailable) {
      console.warn('[engine] ENGINE_SHADOW=1 but native binary absent; using ts adapter');
      return new TsEngineAdapter();
    }
    return new ShadowAdapter(new TsEngineAdapter(), new NativeEngineAdapter());
  }
  if (process.env.ENGINE_BACKEND === 'ts' || !_nativeAvailable) {
    return new TsEngineAdapter();
  }
  return new NativeEngineAdapter();
}

export const engine: EngineAdapter = buildEngine();

export * from './clock';
export * from './fen-utils';
export * from './game-state';
export * from './move-validator';
export * from './pgn-builder';
export * from './adapter';
export { TsEngineAdapter } from './ts-adapter';
export { NativeEngineAdapter } from './native-adapter';

import type { EngineAdapter } from './adapter';
import { TsEngineAdapter } from './ts-adapter';
import { NativeEngineAdapter } from './native-adapter';

let _nativeAvailable = false;
try {
  require('@purechess/engine-native');
  _nativeAvailable = true;
} catch {
  _nativeAvailable = false;
}

export const engine: EngineAdapter =
  process.env.ENGINE_BACKEND === 'ts' || !_nativeAvailable
    ? new TsEngineAdapter()
    : new NativeEngineAdapter();

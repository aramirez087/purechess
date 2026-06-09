export const ENGINE_BACKEND = Symbol('ENGINE_BACKEND');
export const ENGINE_ADAPTER = Symbol('ENGINE_ADAPTER');

export let nativeAvailable = false;
try {
  require('@purechess/engine-native');
  nativeAvailable = true;
} catch {
  nativeAvailable = false;
}

export function getEngineBackend(): 'native' | 'ts' | 'shadow-ts' {
  if (process.env.ENGINE_SHADOW === '1') return nativeAvailable ? 'shadow-ts' : 'ts';
  const env = process.env.ENGINE_BACKEND;
  if (env === 'native' && nativeAvailable) return 'native';
  return 'ts';
}

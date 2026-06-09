export const ENGINE_BACKEND = Symbol('ENGINE_BACKEND');
export const ENGINE_ADAPTER = Symbol('ENGINE_ADAPTER');

export let nativeAvailable = false;
try {
  // Attempt to load the native package at startup to verify the binary is present.
  // The CJS shim will throw MODULE_NOT_FOUND if purechess-engine-native is not installed.
  require('@purechess/engine-native');
  nativeAvailable = true;
} catch {
  nativeAvailable = false;
}

export function getEngineBackend(): 'native' | 'ts' {
  const env = process.env.ENGINE_BACKEND;
  if (env === 'native' && nativeAvailable) return 'native';
  return 'ts';
}

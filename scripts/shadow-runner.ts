/**
 * Shadow parity runner — compares TsEngineAdapter vs NativeEngineAdapter across 200+ game traces.
 *
 * Run from repo root:
 *   pnpm engine:shadow
 *
 * In CI (no native binary): ENGINE_BACKEND=ts causes both sides to use TsEngineAdapter,
 * guaranteeing 0 divergences. This validates runner infrastructure.
 *
 * Staging (native binary present): ENGINE_BACKEND omitted or set to 'native' runs true
 * ts-vs-native comparison. Any divergences are logged and the script exits non-zero.
 */

import { createRequire } from 'module';
import { TsEngineAdapter } from '../apps/api/src/chess/engine/ts-adapter';
import { NativeEngineAdapter } from '../apps/api/src/chess/engine/native-adapter';
import { runShadowSuite } from '../apps/api/src/chess/engine/shadow-runner';
import type { GameTrace } from '../apps/api/src/chess/engine/shadow-runner';

const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const traces: GameTrace[] = _require('../apps/api/src/chess/engine/__fixtures__/game-traces.json');

async function main(): Promise<void> {
  let nativeAvailable = false;
  try {
    require('../packages/engine-native/index.js');
    nativeAvailable = true;
  } catch {
    nativeAvailable = false;
  }

  const useTsOnly = process.env.ENGINE_BACKEND === 'ts' || !nativeAvailable;
  const ts = new TsEngineAdapter();
  const native = useTsOnly ? new TsEngineAdapter() : new NativeEngineAdapter();

  if (useTsOnly) {
    process.stderr.write('[shadow] Native binary absent or ENGINE_BACKEND=ts; running ts-vs-ts mode\n');
  } else {
    process.stderr.write('[shadow] Running ts-vs-native mode\n');
  }

  const summary = await runShadowSuite(traces, ts, native);

  process.stdout.write(`Traces: ${summary.tracesRun}, Divergences: ${summary.divergences}\n`);

  if (summary.divergences > 0) {
    for (const d of summary.divergenceDetails) {
      process.stderr.write(JSON.stringify(d, null, 2) + '\n');
    }
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});

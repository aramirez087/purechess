# Session 03 Handoff — Engine Client

**Scope delivered:** Extended the client-side Stockfish wrapper
(`apps/web/src/lib/engine/stockfish-client.ts`) with evaluation, principal
variations, hints, adjustable strength (Skill + ELO), adjustable think-time,
cancellation, warm-up, and a typed timeout error. `getBestMove` stays
backward-compatible. Stockfish remains **client-side in the Web Worker** — no
server engine was added.

## Files changed / created

- **Rewritten** `apps/web/src/lib/engine/stockfish-client.ts` — full public API
  below; refactored onto a single serialized `runGo` core over the shared
  worker.
- **Created** `apps/web/test/engine/stockfish-client.test.ts` — 17 Vitest cases
  with a mocked `Worker` (postMessage/onmessage), all passing.
- **Created** this handoff.

## Public API surface (typed against `@purechess/shared`)

```ts
import type { EngineAnalysisOptions, EngineEval } from '@purechess/shared';

// Errors — catch with instanceof.
export class EngineTimeoutError extends Error {}    // name: 'EngineTimeoutError'
export class EngineCancelledError extends Error {}  // name: 'EngineCancelledError'

// Position analysis — resolves the objectively best (multipv=1) line.
export function analyze(fen: string, options?: EngineAnalysisOptions): Promise<EngineEval>;

// Best move (UCI) for the side to move at a difficulty level (1-8 → Skill bucket).
export function getHint(fen: string, level: number): Promise<string>;

// Move *selection* with the human-like blunder knob (see below). Used by getHint
// and available to the UI (Session 04) for lower-strength bots.
export function getHumanMove(fen: string, options?: EngineAnalysisOptions): Promise<string>;

// Stop the in-flight search; rejects the pending promise with EngineCancelledError.
export function cancel(): void;

// Trigger / await the UCI handshake (resolves on `uciok`). Pre-warm before first search.
export function warmUp(): Promise<void>;

// Backward-compatible — unchanged signature, existing callers keep working.
export function getBestMove(fen: string, level: number, movetimeMs?: number): Promise<string>;

// Pure helper, exported for tests.
export function parseInfoLine(line: string): (Partial<EngineEval> & { multipv: number }) | null;

// Test-only reset of module singletons.
export function __resetForTests(): void;
```

`EngineEval` / `EngineAnalysisOptions` come straight from
`packages/shared/src/dto/engine-analysis.dto.ts` (Session 01) — **not modified**
(Decision D9 held; every needed field already existed).

## Key decisions + rationale

1. **Single serialized job queue.** UCI runs one search at a time; the shared
   worker is stateful. All public calls chain through a module-level
   `currentJob` promise so `info`/`bestmove` streams from different callers never
   interleave. One in-flight search at a time → `cancel()` is unambiguous.

2. **Every job emits its full `setoption` set before every `go`.** MultiPV,
   `UCI_LimitStrength`, and the strength value (ELO or Skill) are re-sent each
   search so a prior job's state can't leak (e.g. a stale ELO cap bleeding into a
   later Skill-mode call).

3. **Strength = two modes.** `eloTarget` set → `UCI_LimitStrength=true` +
   `UCI_Elo=<clamped>`. Otherwise → `UCI_LimitStrength=false` +
   `Skill Level=<skill ?? 20>`. **ELO is clamped to [1320, 3190]** (vendored
   Stockfish range); out-of-range targets are silently clamped.

4. **`analyze` is analysis, not move choice.** It always returns the multipv=1
   (objectively best) line. The blunder/style knob lives only in `getHumanMove`,
   so eval reporting is never perturbed by human-like move selection.

5. **Blunder knob (deterministic).** When `blunderCp > 0`, `getHumanMove` forces
   MultiPV to `[2,3]`, then keeps lines whose signed cp is within
   `[topCp - blunderCp, topCp]` (no better than best, no worse than the window;
   mate scored via a signed ±100000 sentinel). The pick index is a `mulberry32`
   PRNG seeded by `deterministicSeed` (default `0`). **Same seed → same move; no
   `Math.random`.** Seed 0 with a tight window collapses to the best line.

6. **Think-time.** `movetimeMs` option threads into `go movetime`; default
   `1000` unchanged. `getBestMove`'s 3rd positional arg still works.

7. **Cancellation.** `cancel()` posts `stop`, clears the timeout, removes the
   listener, and rejects with `EngineCancelledError`. The late `bestmove` the
   engine emits after `stop` is ignored (listener already gone) and the queue
   advances. No-op when idle.

8. **Timeout.** Replaced the silent `new Error('timeout')` with a typed,
   catchable `EngineTimeoutError`. Per-search timeout =
   `max(movetimeMs + 5000, 10000)` so long think-times don't false-timeout.

9. **Warm-up.** `warmUp()` awaits the memoized `getWorker()` handshake (resolves
   on `uciok`). The handshake promise is now nulled on worker-construction or
   `error` failure so a transient failure doesn't poison all future calls.

## Notes for downstream (Session 04 — web data layer / UI)

- **Use `getHumanMove` for the bot's actual move** at lower levels (pass
  `blunderCp`, `eloTarget`/`skill`, `movetimeMs`, `deterministicSeed`). Use
  `analyze` for an eval bar / PV display, `getHint` for a hint button.
- `cancel()` is module-global (single shared worker, single in-flight job) —
  call it when the user takes back / navigates away mid-search.
- All four (`analyze`/`getHint`/`getHumanMove`/`cancel`/`warmUp`) operate on the
  same lazy shared worker; call `warmUp()` once on game mount to hide startup
  latency.

## Quality gates — results

- `pnpm --filter @purechess/shared build` → **PASS**.
- `apps/web` typecheck → **no new errors**; the only errors are the
  **pre-existing** ones flagged in Session 01 (`lucide-react` `Github`/`Twitter`,
  admin `games-table`/`reports-table` `children`, `admin/reports/[id]` Element).
  No `engine/stockfish-client` errors.
- `apps/web` lint (`next lint`) → **PASS** (`✔ No ESLint warnings or errors`).
- `pnpm exec vitest run test/engine/` → **17/17 PASS**.
- `pnpm exec vitest run test/` → 120 pass / 10 fail; the 10 failures are
  **pre-existing** (verified by re-running the suite with all Session-03 changes
  removed: identical 10 failures in `home/homepage` + `settings/settings-dialog`,
  unrelated to the engine).

## Open risks

- ELO clamp range [1320, 3190] is the common Stockfish default but build-specific
  — re-check if the vendored worker is swapped.
- `info` lines without a `pv` (bound-only updates) are intentionally dropped; a
  search that emits *only* such lines before `bestmove` falls back to
  synthesizing the eval from the `bestmove` token (depth 0, pv = [move]).

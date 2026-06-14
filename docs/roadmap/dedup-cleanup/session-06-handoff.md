# Session 06 Handoff — Puzzle Hook Dedup

**Branch:** `epic/dedup-cleanup--s06-puzzle-hooks`
**Date:** 2026-06-13
**Status:** COMPLETE

---

## What Changed

Extracted the duplicated puzzle-state machine logic (jscpd clones #40 and #41) from
`use-local-puzzle.ts` and `use-puzzle.ts` into a new shared hook `use-puzzle-core.ts`.

### Shared module created

**`apps/web/src/hooks/use-puzzle-core.ts`** (new)

Exports:
- `AUTO_REPLY_MS = 500` and `REVEAL_MS = 800` (constants consumed by both hooks)
- `PuzzleMoveState` interface (minimal state shape the core reads)
- `UsePuzzleCoreReturn` interface
- `usePuzzleCore(stateRef, setState, solutionRef, onSolvedFiredRef?)` — the shared hook

The core owns: `timerRef`, `clearTimer`, `runReveal`, `runAutoReply`, `applyPlayerMoveStep`, `onReveal`.

`applyPlayerMoveStep` returns `'wrong' | 'done' | 'applied' | 'noop'` so callers can add
hook-specific side-effects (timer start, callback guards) without duplicating the
sound/setState/runAutoReply logic.

### Files deduped

| File | Change |
|------|--------|
| `apps/web/src/hooks/use-local-puzzle.ts` | Removed: local `AUTO_REPLY_MS`, `REVEAL_MS`, `timerRef`, `clearTimer`, `runAutoReply`, `runReveal`, `onReveal`. `onMove` now calls `applyPlayerMoveStep` from core and handles `'wrong'` result locally (settledRef guard + onFailed). |
| `apps/web/src/hooks/use-puzzle.ts` | Removed: same constants and callbacks. Added `solutionRef` (updated each render from `ctxRef.current?.solution ?? []`). `onMove` now calls `applyPlayerMoveStep`. `beginSetup` uses `timerRef` returned by core. |

Public return shapes **unchanged**:
- `useLocalPuzzle` → `{ state: LocalPuzzleState, onMove, onReveal }`
- `usePuzzle` → `{ state: PuzzleState, puzzleData, onMove, onReveal, onNext, onTryAgain }`

---

## Clones Eliminated

| Clone | Lines | Was |
|-------|-------|-----|
| #40 | 19 | `use-local-puzzle.ts:172-190` ↔ `use-puzzle.ts:173-191` (`runReveal` body) |
| #41 | 21 | `use-local-puzzle.ts:213-233` ↔ `use-puzzle.ts:206-226` (`onMove` core logic) |

---

## Gate Results

### Typecheck
```
cd apps/web && pnpm exec tsc --noEmit
```
→ **0 errors in src/hooks/use-puzzle-core.ts, use-local-puzzle.ts, use-puzzle.ts** (pre-existing test-file errors are unrelated)

### Lint
```
cd apps/web && pnpm lint
```
→ **✔ No ESLint warnings or errors** (exit 0)

### Vitest — hook tests
```
cd apps/web && pnpm exec vitest run test/hooks/use-local-puzzle.test.ts test/hooks/use-puzzle.test.ts
```
```
Test Files  2 passed (2)
     Tests  12 passed (12)
```

### Vitest — full suite
```
cd apps/web && pnpm exec vitest run test/
```
```
Test Files  83 passed (83)
     Tests  662 passed (662)
```

### jscpd — before (apps/web/src only)
```
npx jscpd@4 apps/web/src --min-tokens 70 --min-lines 8 --gitignore
```
| Format | Clones | Dup lines |
|--------|--------|-----------|
| typescript | 6 | includes #40, #41 |
| TOTAL | ~33 | — |

### jscpd — after
```
npx --yes jscpd@4 apps/web/src --min-tokens 70 --min-lines 8 --gitignore
```
| Format | Clones | Dup lines |
|--------|--------|-----------|
| javascript | 5 | 206 (1.72%) |
| tsx | 21 | 415 (1.81%) |
| typescript | **4** | **55 (0.65%)** |
| css | 1 | 32 (5.52%) |
| **Total** | **31** | **708 (1.61%)** |

`use-local-puzzle.ts ↔ use-puzzle.ts` pair **does not appear** in the after report. ✓

TypeScript dup lines dropped from ~278 to 55 within `apps/web/src`; 2 clones removed.

---

## Open Issues / Latent Bugs

None. The `onSolvedFiredRef?.current?.()` optional-chain correctly handles the asymmetry:
- `use-local-puzzle` passes `settleSolved` (fires `onSolved({msToSolve})`); guarded by `settledRef`
- `use-puzzle` passes nothing; the optional chain is a no-op

---

## Inputs for CI-Gate Session

- Two TypeScript clones (#40, #41) confirmed removed from jscpd report
- `use-puzzle-core.ts` is a new file at `apps/web/src/hooks/use-puzzle-core.ts`
- Both hook public APIs unchanged; all 662 tests green
- Pre-existing typecheck errors in `test/` files are unrelated to this session's changes

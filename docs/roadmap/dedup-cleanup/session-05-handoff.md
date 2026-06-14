# Session 05 Handoff — Training Shell Dedup

**Branch:** `epic/dedup-cleanup--s05-training-shell`
**Date:** 2026-06-13
**Clones targeted:** #24 (35 lines) and #25 (21 lines)

---

## What Changed

Extracted three shared presentational pieces from the duplicated board+prompt regions into a new shared module, then rewrote both callers to use it.

### New file

**`apps/web/src/components/puzzle/solve-session-shell.tsx`**

Exports:
- `SolveState` — type alias for the hook-state shape both callers use (`fen`, `solvingColor`, `phase`, `lastMove`).
- `PuzzleBoardPane` — the `<div max-w-[560px]> → <div relative ref> → <Chessboard>` wrapper. Owns board geometry, position/orientation/readOnly/lastMove/onMove wiring. Accepts `children` for caller-specific overlays.
- `PuzzlePrompt` — the "Find the best move for White/Black" paragraph, parameterised by `phase`, `solvingColor`, and `hasOutcome`.
- `Overlay` — the absolute-positioned backdrop used inside the board frame for loading/error/outcome states.

The `Chessboard` import and `Square` cast now live here only.

### Modified files

**`apps/web/src/components/puzzle/training-session.tsx`**
- Removed: `Chessboard` import, `Square` type import, local `Overlay` function.
- Added: `Overlay`, `PuzzleBoardPane`, `PuzzlePrompt` from `./solve-session-shell`.
- Board pane block (former lines 271–316) replaced with `<PuzzleBoardPane>` + overlay children.
- Prompt paragraph (former lines 319–331) replaced with `<PuzzlePrompt>`.

**`apps/web/src/app/puzzles/review/review-client.tsx`**
- Removed: `Chessboard` import, `Square` type import, `cn` import, local `Overlay` function.
- Added: `Overlay`, `PuzzleBoardPane`, `PuzzlePrompt` from `@/components/puzzle/solve-session-shell`.
- Board pane block (former lines 258–291) replaced with `<PuzzleBoardPane>` + overlay children.
- Prompt paragraph (former lines 294–306) replaced with `<PuzzlePrompt>`.

No behavior change. All `data-testid` attributes (`session-progress`, `attempt-readout`, `rating-delta`, `review-progress`, `review-readout`, `session-summary`, `review-summary`) remain on their original elements in the callers.

---

## Gate Results

### Typecheck

```
cd apps/web && pnpm exec tsc --noEmit
```
**EXIT 0** (clean)

### Lint

```
cd apps/web && pnpm lint
```
**EXIT 0** — `✔ No ESLint warnings or errors`

### Vitest — targeted

```
cd apps/web && pnpm exec vitest run test/puzzle/training-session.test.tsx
```
```
✓ test/puzzle/training-session.test.tsx  (4 tests) 2454ms
Test Files  1 passed (1)
```

### Vitest — full suite

```
cd apps/web && pnpm exec vitest run test/
```
```
Test Files  83 passed (83)
     Tests  662 passed (662)
```

### jscpd — `apps/web/src` only

```
npx --yes jscpd@4 apps/web/src --min-tokens 70 --min-lines 8 --gitignore
```

`training-session.tsx` ↔ `review-client.tsx` no longer appears in the output.

| Format | Clones | Dup lines |
|--------|--------|-----------|
| tsx | 20 | 395 (1.72%) |
| javascript | 5 | 226 (1.9%) |
| typescript | 6 | 93 (1.09%) |
| css | 1 | 32 (5.52%) |
| **Total** | **32** | **746 (1.7%)** |

Clones #24 and #25 confirmed gone. Remaining tsx clones are all in other sessions' scope or boilerplate.

---

## jscpd Before / After for This Cluster

| | Clone pair | Lines |
|-|-----------|-------|
| Before | `training-session.tsx:262-296` ↔ `review-client.tsx:238-281` | 35 |
| Before | `training-session.tsx:313-333` ↔ `review-client.tsx:288-308` | 21 |
| After | *(neither pair appears)* | 0 |

Bonus: `Overlay` function (~18 lines) also deduplicated (was below jscpd threshold but removed by the same extraction).

---

## Open Issues

None introduced. Pre-existing unclaimed clusters (#3, #10, #36-38, #42 from S01) remain untouched.

---

## Inputs for CI-Gate Session

- Files changed: `apps/web/src/components/puzzle/solve-session-shell.tsx` (new), `training-session.tsx`, `review-client.tsx`.
- Assertion: `training-session.tsx` ↔ `review-client.tsx` must NOT appear in jscpd output.
- Vitest: `test/puzzle/training-session.test.tsx` all 4 tests green; full `test/` suite 662 green.
- Typecheck: `cd apps/web && pnpm exec tsc --noEmit` exits 0.
- Lint: `cd apps/web && pnpm lint` exits 0.

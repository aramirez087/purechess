# Session 03 Handoff — Rating Chart Dedup

**Branch:** `epic/dedup-cleanup--s03-rating-charts`
**Date:** 2026-06-13
**Clones eliminated:** #26 (58 lines), #27 (36 lines), #28 (13 lines) — 107 lines total

---

## What Changed

Extracted the duplicated SVG chart logic from `rating-chart.tsx` and `puzzle-rating-chart.tsx`
into a new shared module. Both callers are now thin wrappers — identical rendered output and
public APIs.

---

## Shared Module Created

**`apps/web/src/components/charts/line-rating-chart.tsx`** (new)

Exports:
- `VB_W`, `VB_H`, `PLOT` — viewBox geometry constants
- `monthFmt`, `dayFmt` — `Intl.DateTimeFormat` instances (shared, no double instantiation)
- `ChartCoord`, `ChartGridline`, `ChartXLabel`, `ChartLayout` — pure TS interfaces
- `computeChartLayout(ratings, timestamps)` — pure math fn; returns `ChartLayout | null`
- `LineRatingChart` — shared SVG component (gridlines, xLabels, polyline, dots, hit rects)
- `ChartTooltip` — shared tooltip wrapper (handles `pointer-events` + position math)

---

## Files Deduped

| File | Change |
|------|--------|
| `apps/web/src/components/profile/rating-chart.tsx` | Removed 5 const declarations; replaced `useMemo` layout block with `computeChartLayout`; replaced `<svg>` block with `<LineRatingChart>`; replaced tooltip div with `<ChartTooltip>` |
| `apps/web/src/components/puzzle/puzzle-rating-chart.tsx` | Same removals; `dotFill={() => 'hsl(var(--primary))'}` (constant fill, no delta coloring) |

Public APIs unchanged:
- `export function RatingChart({ history, className }: RatingChartProps)` — unchanged
- `export function PuzzleRatingChart({ history, className }: PuzzleRatingChartProps)` — unchanged

---

## Design Decisions

1. **`computeChartLayout` takes `number[]`, not a domain type.** Callers own `ratingAfter`/`rating` and `playedAt`/`at` fields. The util is pure math, no business coupling.
2. **`dotFill` as `(i: number) => string`.** `rating-chart` needs per-dot color via `dotColor(delta)`, `puzzle-rating-chart` uses a constant. One callback handles both.
3. **`dotTestId` / `hitTestId` props.** Existing test queries `[data-testid="rating-dot"]` and `[data-testid="rating-hit"]` — passing them as props preserves exact values.
4. **Safer math guards from puzzle-chart used in shared fn.** `|| 1` span guard, `Math.round` on gridlines, `Math.max(1, ...)` on xLabel divisor — invisible to all existing inputs.
5. **`ChartTooltip` wrapper.** Eliminates structural similarity; `pointerEvents="auto"` for rating-chart (game link is clickable), `"none"` for puzzle-chart.

---

## Quality Gate Results

### TypeScript
```
cd apps/web && pnpm exec tsc --noEmit
```
**EXIT 0** (clean after `pnpm install` + `pnpm --filter @purechess/shared build`)

### Lint
```
cd apps/web && pnpm lint
```
**EXIT 0** — `✔ No ESLint warnings or errors`

### Unit Tests
```
cd apps/web && pnpm exec vitest run test/
```
**83 test files, 662 tests — all passed**

Key tests covering the deduped code:
- `test/profile/rating-chart.test.tsx` — 7 tests (dots, filter, tooltip, gameId link) all green

### jscpd (apps/web/src only)

Before (S01 baseline for web/src files):
- Clones #26, #27, #28 between `rating-chart.tsx` ↔ `puzzle-rating-chart.tsx` (107 lines)

After:
```
npx --yes jscpd@4 apps/web/src --min-tokens 70 --min-lines 8 --gitignore
```
```
│ tsx        │ 181 │ 22943 │ 189922 │ 20  │ 403 (1.76%)  │ 3187 (1.68%)  │
│ Total:     │ 424 │ 43971 │ 368131 │ 30  │ 642 (1.46%)  │ 5470 (1.49%) │
```

**`rating-chart.tsx` / `puzzle-rating-chart.tsx` pair is ABSENT from clone list.**

Remaining tsx clones are from other sessions' clusters (S04–S10) or boilerplate
(`error.tsx`, `global-error.tsx`, `loading.tsx`) — all expected.

---

## jscpd Before / After for This Cluster

| Metric | Before | After |
|--------|--------|-------|
| Clone #26 (58 lines) | Present | Gone |
| Clone #27 (36 lines) | Present | Gone |
| Clone #28 (13 lines) | Present | Gone |
| Total lines eliminated | — | 107 |

---

## No Behavior Change

- Rendered SVG output: identical (same viewBox, strokes, gridlines, dots, hit targets)
- Tooltip position + content: identical
- `pointer-events`: preserved (`auto` for rating-chart game link, `none` for puzzle-chart)
- `data-testid` values: preserved exactly (`rating-dot`, `rating-hit`, `puzzle-rating-dot`, `puzzle-rating-hit`)
- Empty states: unchanged (both callers keep their own empty state rendering)

---

## Open Issues

None for this cluster. The 4 unclaimed clusters from S01 (#10, #36-38, #42) remain.

---

## Inputs for CI-Gate Session

- S03 eliminated 107 lines from 3 TSX clones
- New shared module: `apps/web/src/components/charts/line-rating-chart.tsx`
- No new tests needed (covered transitively by `test/profile/rating-chart.test.tsx`)
- No `packages/shared` changes (no cross-package extraction needed)

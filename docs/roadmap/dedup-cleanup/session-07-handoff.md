# Session 07 Handoff — Play Setup UI Dedup

**Branch:** `epic/dedup-cleanup--s07-setup-ui`
**Date:** 2026-06-13
**Session:** S07 — Play dialog time-control/color/stakes deduplication

---

## What Changed

Extracted four shared components and one shared constant from the four play setup dialogs, eliminating jscpd clones #29–#32.

---

## Shared Module Created

**`apps/web/src/components/play/time-control-picker.tsx`** (NEW)

Exports:
- `TimeControlOption` — interface `{ label: string; sub: string }`
- `TimeControlPickerProps` / `<TimeControlPicker>` — generic pill grid (clone #29)
- `StakesPickerProps` / `<StakesPicker>` — Rated/Casual section (clone #30)
- `PieceColor` — type alias `'white' | 'black' | 'random'`
- `ColorPickerProps` / `<ColorPicker>` — color selector (clone #32)
- `LEVEL_LABELS` — `Record<number, string>` constant (duplicated literal)
- `StrengthMode` — type alias `'level' | 'elo'`
- `StrengthModePickerProps` / `<StrengthModePicker>` — mode toggle (clone #31)

---

## Files Deduped

| File | Changes |
|------|---------|
| `apps/web/src/components/play/invite-create.tsx` | Removed local `COLORS` const; replaced time-control grid + color grid + stakes section with `<TimeControlPicker>`, `<ColorPicker>`, `<StakesPicker>`; state type changed from `InviteColor` to `PieceColor` |
| `apps/web/src/components/play/quick-match-setup.tsx` | Replaced time-control grid + stakes section with `<TimeControlPicker>`, `<StakesPicker>`; removed pill-styles + Label + cn imports |
| `apps/web/src/components/play/computer-game-setup.tsx` | Removed local `LEVEL_LABELS` + `COLORS` consts; replaced color grid with `<ColorPicker>`, strength-mode toggle with `<StrengthModePicker>`; state types updated to `PieceColor`/`StrengthMode` |
| `apps/web/src/components/play/practice-from-fen-dialog.tsx` | Removed local `LEVEL_LABELS` + `COLORS` consts; replaced color grid with `<ColorPicker>`, strength-mode toggle with `<StrengthModePicker>`; state types updated to `PieceColor`/`StrengthMode` |

---

## Gate Results

### TypeScript (src only — test file errors are pre-existing)
```
cd apps/web && pnpm exec tsc --noEmit 2>&1 | grep -v "^test/" | grep "error TS"
# (no output — clean)
```

### Lint
```
cd apps/web && pnpm lint
✔ No ESLint warnings or errors
```

### Targeted Vitest
```
cd apps/web && pnpm exec vitest run test/play/quick-match-setup.test.tsx test/components/practice-from-fen-dialog.test.tsx
Test Files  2 passed (2)
     Tests  9 passed (9)
```

### Full Vitest
```
cd apps/web && pnpm exec vitest run test/
Test Files  83 passed (83)
     Tests  662 passed (662)
```

### jscpd (apps/web/src only)

**Before (S01 baseline for tsx):** 21 clones / 415 dup lines (1.81%)

**After:**
```
npx --yes jscpd@4 apps/web/src --min-tokens 70 --min-lines 8 --gitignore
tsx: 18 clones / 336 dup lines (1.47%)
Total: 30 clones / 667 dup lines (1.52%)
```

**Clone pairs #29–#32 confirmed absent:**
- `invite-create.tsx` ↔ `quick-match-setup.tsx` → GONE ✓
- `computer-game-setup.tsx` ↔ `practice-from-fen-dialog.tsx` → GONE ✓
- `computer-game-setup.tsx` ↔ `invite-create.tsx` → GONE ✓

---

## jscpd Before/After for S07 Cluster

| Metric | Before | After |
|--------|--------|-------|
| tsx clones | 21 | 18 |
| tsx dup lines | 415 (1.81%) | 336 (1.47%) |
| Play-setup pairs in clone list | 3 pairs (#29/#30, #31, #32) | 0 |

---

## Open Issues / Notes

- **`readonly` constraint on `TimeControlPickerProps.options`:** `MATCHMAKING_TIME_CONTROLS` from `@purechess/shared` is `readonly`, so the `options` prop type was widened to `readonly TimeControlOption[]`.
- **`PieceColor` vs `InviteColor`/`CreateComputerGameDto['color']`/`CreateFromFenDto['color']`:** All three are structurally identical `'white' | 'black' | 'random'` unions. State types changed to `PieceColor`; TypeScript accepts them at the DTO construction call sites without casts.
- No behavior changes — all option labels, defaults, pressed states, and emitted values preserved exactly.

---

## Inputs for CI-Gate Session

- S07 cluster clones #29–#32 confirmed eliminated
- tsx dup lines: 415 → 336 (−79 lines, −3 clones)
- New shared module: `apps/web/src/components/play/time-control-picker.tsx`
- All existing tests pass (83 files, 662 tests)
